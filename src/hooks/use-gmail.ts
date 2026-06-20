/**
 * Loads the signed-in user's Gmail inbox (or search results) with infinite
 * scroll: the first page loads on auth, and `loadMore` appends the next page
 * via Gmail's `nextPageToken` as the user scrolls to the bottom.
 *
 * `loadMore` waits `LOAD_MORE_DELAY_MS` before fetching so the on-screen cards'
 * local-AI summaries (TODO #8) have a moment to catch up before more cards mount
 * and flood the single-threaded summarizer queue.
 *
 * Search is **server-side**: setting `searchQuery` runs a Gmail `q` search over
 * the whole mailbox (debounced) and resets to the first page.
 */
import { useEffect, useRef, useState } from 'react';

import { useGoogleAuth } from '@/hooks/use-google-auth';
import {
  fetchInbox,
  getProfile,
  markMessageRead,
  type GmailMessage,
  type GmailProfile,
} from '@/lib/gmail';
import { log, logError } from '@/lib/log';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
// Breather before fetching the next page, giving summaries time to progress.
const LOAD_MORE_DELAY_MS = 1500;

export type Mailbox = 'inbox' | 'sent';

// Combine the search box and the read toggle into one Gmail `q` query.
// `showRead` true → read + unread (empty query = default label listing); false →
// unread only (`is:unread`, scoped to the mailbox when there's no free-text search).
function buildQuery(search: string, showRead: boolean, mailbox: Mailbox): string {
  const term = search.trim();
  if (showRead) return term;
  return term ? `${term} is:unread` : `in:${mailbox} is:unread`;
}

// Collapse a conversation to a single card: keep the first (newest) message of
// each thread and drop later ones. `seen` carries thread ids across pages.
function dedupeByThread(messages: GmailMessage[], seen: Set<string>): GmailMessage[] {
  const out: GmailMessage[] = [];
  for (const m of messages) {
    if (seen.has(m.threadId)) continue;
    seen.add(m.threadId);
    out.push(m);
  }
  return out;
}

export function useGmail(mailbox: Mailbox = 'inbox') {
  const { isAuthenticated, getAccessToken } = useGoogleAuth();
  const labelId = mailbox === 'sent' ? 'SENT' : 'INBOX';
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Whether read emails are shown alongside unread ones. The inbox defaults to
  // unread-only (marking read drops it from view); Sent shows everything.
  const [showRead, setShowRead] = useState(mailbox !== 'inbox');

  // Next-page cursor + an in-flight guard (refs so they don't trigger renders
  // and stay current across rapid onEndReached calls). `queryRef` keeps the
  // active search string available to loadMore; `seenThreads` collapses
  // conversations across pages.
  const pageToken = useRef<string | undefined>(undefined);
  const inFlight = useRef(false);
  const queryRef = useRef('');
  const seenThreads = useRef<Set<string>>(new Set());

  async function load(mode: 'initial' | 'refresh', query: string) {
    if (inFlight.current) return;
    const token = await getAccessToken();
    if (!token) {
      setError('Not signed in.');
      return;
    }
    inFlight.current = true;
    queryRef.current = query;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      log('gmail', `load(${mode}) start`, { query });
      const [profileData, inbox] = await Promise.all([
        getProfile(token),
        fetchInbox(token, { maxResults: PAGE_SIZE, query: query || undefined, labelId }),
      ]);
      log('gmail', 'load done', {
        total: profileData.messagesTotal,
        page: inbox.messages.length,
        hasMore: !!inbox.nextPageToken,
      });
      setProfile(profileData);
      seenThreads.current = new Set();
      setMessages(dedupeByThread(inbox.messages, seenThreads.current));
      pageToken.current = inbox.nextPageToken;
      setHasMore(!!inbox.nextPageToken);
    } catch (e) {
      logError('gmail', e, '(load failed)');
      setError(e instanceof Error ? e.message : 'Failed to load inbox.');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (inFlight.current || !pageToken.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    // Give on-screen summaries a moment before mounting another page of cards.
    await new Promise((r) => setTimeout(r, LOAD_MORE_DELAY_MS));
    const token = await getAccessToken();
    if (!token || !pageToken.current) {
      inFlight.current = false;
      setLoadingMore(false);
      return;
    }
    const query = queryRef.current;
    try {
      log('gmail', 'loadMore start', { pageToken: pageToken.current, query });
      const inbox = await fetchInbox(token, {
        maxResults: PAGE_SIZE,
        pageToken: pageToken.current,
        query: query || undefined,
        labelId,
      });
      // Collapse conversations and drop any thread already shown on a prior page.
      const fresh = dedupeByThread(inbox.messages, seenThreads.current);
      log('gmail', 'loadMore done', { added: fresh.length, hasMore: !!inbox.nextPageToken });
      setMessages((prev) => [...prev, ...fresh]);
      pageToken.current = inbox.nextPageToken;
      setHasMore(!!inbox.nextPageToken);
    } catch (e) {
      logError('gmail', e, '(loadMore failed)');
      setError(e instanceof Error ? e.message : 'Failed to load more.');
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }

  // Mark a message read: optimistically update the list (drop it when showing
  // unread-only), then tell Gmail. On failure, reload to resync.
  async function markRead(id: string) {
    const wasUnread = messages.find((m) => m.id === id)?.unread;
    if (!wasUnread) return;
    setMessages((prev) =>
      showRead
        ? prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
        : prev.filter((m) => m.id !== id),
    );
    const token = await getAccessToken();
    if (!token) return;
    try {
      log('gmail', 'markRead', { id });
      await markMessageRead(token, id);
    } catch (e) {
      logError('gmail', e, '(markRead failed)');
      void load('refresh', buildQuery(searchQuery, showRead, mailbox));
    }
  }

  // Load (or clear) the inbox as auth state / search query changes. All state
  // updates live in the async closure so none run synchronously in the effect
  // body. A new search is debounced so we don't hit Gmail on every keystroke.
  useEffect(() => {
    let cancelled = false;
    const query = buildQuery(searchQuery, showRead, mailbox);
    (async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setMessages([]);
          setProfile(null);
          setError(null);
          queryRef.current = '';
          pageToken.current = undefined;
          seenThreads.current = new Set();
          setHasMore(false);
        }
        return;
      }
      // Debounce only while the user is typing in the search box.
      if (searchQuery.trim()) await new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS));
      if (cancelled) return;
      await load('initial', query);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, getAccessToken, searchQuery, showRead]);

  return {
    messages,
    profile,
    /** Total messages in the mailbox (from the Gmail profile). */
    total: profile?.messagesTotal ?? null,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    searchQuery,
    setSearchQuery,
    /** True when results reflect an active search rather than the inbox. */
    searching: searchQuery.trim().length > 0,
    showRead,
    setShowRead,
    markRead,
    reload: () => load('refresh', buildQuery(searchQuery, showRead, mailbox)),
    loadMore,
  };
}
