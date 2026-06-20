/**
 * Minimal Gmail REST API client.
 *
 * Uses an OAuth access token (from `useGoogleAuth().getAccessToken()`) scoped
 * with `gmail.readonly`. Listing only returns message IDs, so we fetch metadata
 * (Subject/From/Date + snippet) per message to build a displayable inbox row.
 *
 * Docs: https://developers.google.com/gmail/api/reference/rest
 */

import { log, warn } from '@/lib/log';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  /** Best preview image found in the body, or null if none (see TODO #7). */
  thumbnailUrl: string | null;
  /** Cleaned plain-text body, used to feed the local summarizer (see TODO #8). */
  bodyText: string;
  /** Whether the message still carries Gmail's `UNREAD` label (see TODO #10). */
  unread: boolean;
};

export class GmailError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GmailError';
    this.status = status;
  }
}

// Gmail rate-limits concurrent requests per user; 429 (and quota/rate 403/503)
// should be retried with backoff rather than surfaced as an error.
function isRateLimited(status: number, detail: string): boolean {
  return (
    status === 429 ||
    ((status === 403 || status === 503) && /rate|concurrent|quota|limit/i.test(detail))
  );
}

async function gmailFetch<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
  attempt = 0,
): Promise<T> {
  const method = init?.method ?? 'GET';
  log('gmail', `${method} ${path}`);
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message ?? '';
    } catch {
      // non-JSON error body — ignore
    }
    if (isRateLimited(res.status, detail) && attempt < 5) {
      const wait = Math.min(4000, 300 * 2 ** attempt) + Math.random() * 250;
      warn('gmail', `${method} ${path} → ${res.status} rate-limited, retry in ${Math.round(wait)}ms`);
      await new Promise((r) => setTimeout(r, wait));
      return gmailFetch(token, path, init, attempt + 1);
    }
    warn('gmail', `${method} ${path} → ${res.status} ${detail}`);
    if (res.status === 401) {
      throw new GmailError(401, 'Session expired — sign in again.');
    }
    if (res.status === 403) {
      throw new GmailError(
        403,
        'Gmail access not granted. Sign out and back in to approve the Gmail permission.',
      );
    }
    throw new GmailError(res.status, detail || `Gmail request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export type GmailProfile = {
  emailAddress: string;
  /** Total number of messages in the mailbox. */
  messagesTotal: number;
  /** Total number of threads in the mailbox. */
  threadsTotal: number;
};

/** Fetch the mailbox profile — includes the total message + thread counts. */
export async function getProfile(token: string): Promise<GmailProfile> {
  const data = await gmailFetch<{
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
  }>(token, '/profile');
  return {
    emailAddress: data.emailAddress,
    messagesTotal: data.messagesTotal,
    threadsTotal: data.threadsTotal,
  };
}

type ListResponse = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type MessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: MessagePart[];
};

type MessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: MessagePart;
};

function header(msg: MessageResponse, name: string): string {
  const found = msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? '';
}

// Interpret a latin1 byte-string (one char per byte, from atob) as UTF-8 text.
// `atob` alone leaves multibyte UTF-8 as garbage, which then breaks the LLM
// tokenizer ("failed to decode input tokens") — so decode it properly.
function utf8FromBytes(bin: string): string {
  let out = '';
  let i = 0;
  const n = bin.length;
  while (i < n) {
    const c = bin.charCodeAt(i++);
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c >= 0xc0 && c < 0xe0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      out += String.fromCharCode(((c & 0x1f) << 6) | c2);
    } else if (c >= 0xe0 && c < 0xf0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      const c3 = bin.charCodeAt(i++) & 0x3f;
      out += String.fromCharCode(((c & 0x0f) << 12) | (c2 << 6) | c3);
    } else if (c >= 0xf0) {
      const c2 = bin.charCodeAt(i++) & 0x3f;
      const c3 = bin.charCodeAt(i++) & 0x3f;
      const c4 = bin.charCodeAt(i++) & 0x3f;
      const cp = (((c & 0x07) << 18) | (c2 << 12) | (c3 << 6) | c4) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
    // stray continuation bytes are skipped
  }
  return out;
}

// Inverse of utf8FromBytes: turn a JS string into a latin1 byte-string where
// each char holds one UTF-8 byte, so `btoa` can base64-encode it without losing
// multibyte characters.
function utf8ToBytes(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    // Combine surrogate pairs into a single code point.
    if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo < 0xe000) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) {
      out += String.fromCharCode(cp);
    } else if (cp < 0x800) {
      out += String.fromCharCode(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out += String.fromCharCode(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out += String.fromCharCode(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}

// Encode a (possibly multibyte) string as base64url — the format Gmail wants for
// the `raw` field of a sent message.
function encodeBase64Url(str: string): string {
  const encode = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (!encode) return '';
  return encode(utf8ToBytes(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Gmail encodes part bodies as base64url. Decode the bytes and read them as UTF-8.
function decodeBase64Url(data: string): string {
  const decode = (globalThis as { atob?: (s: string) => string }).atob;
  if (!decode) return '';
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  try {
    return utf8FromBytes(decode(b64 + pad));
  } catch {
    return '';
  }
}

// Depth-first search of the MIME tree for the first part of the given mime type.
function findPartBody(part: MessagePart | undefined, mime: string): string {
  if (!part) return '';
  if (part.mimeType === mime && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findPartBody(child, mime);
    if (found) return found;
  }
  return '';
}

// Rough HTML → text: drop script/style, turn block ends into newlines, strip tags.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

// Cap the body so the summarizer prompt (body + instruction + generated
// summary) fits the model's 4096-token context window. Cleaned email text runs
// ~0.7 tokens/char, so ~3500 chars ≈ 2400 tokens, leaving room for the output.
const MAX_BODY_CHARS = 3500;

/**
 * Clean an email body into compact plain text for the summarizer (TODO #8):
 * strips base64 data URIs and links, decodes entities, collapses whitespace,
 * and caps the length so it fits the local model's context window.
 */
export function cleanEmailBody(raw: string): string {
  return raw
    .replace(/data:[^\s"')]+/gi, ' ') // base64 / data URIs
    .replace(/https?:\/\/\S+/gi, ' ') // links (tracking, unsubscribe, etc.)
    // Control chars + the U+FFFD replacement char break the tokenizer; keep \n\t.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ') // any remaining named entities
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// The full cleaned body. Prefers text/plain, else derives from the HTML.
function extractFullBody(payload?: MessagePart): string {
  const plain = findPartBody(payload, 'text/plain');
  const source = plain || htmlToText(findPartBody(payload, 'text/html'));
  return cleanEmailBody(source);
}

// Cleaned body capped to fit the summarizer's context window (TODO #8).
function extractBodyText(payload?: MessagePart): string {
  return extractFullBody(payload).slice(0, MAX_BODY_CHARS);
}

// A declared dimension (e.g. width="600" or style="width:600px") in px, or null.
function readDimension(tag: string, attr: 'width' | 'height'): number | null {
  const fromAttr = new RegExp(`\\b${attr}\\s*=\\s*["']?(\\d+)`, 'i').exec(tag);
  if (fromAttr) return Number(fromAttr[1]);
  const fromStyle = new RegExp(`${attr}\\s*:\\s*(\\d+)\\s*px`, 'i').exec(tag);
  if (fromStyle) return Number(fromStyle[1]);
  return null;
}

// Images this small are almost always tracking pixels or spacers.
const TRACKING_MAX_PX = 2;

/**
 * Pick a thumbnail from an HTML email body: the largest remote image by declared
 * area, ignoring tracking pixels; if none declare a size, the first image wins.
 */
export function extractThumbnailUrl(html: string): string | null {
  if (!html) return null;
  const candidates: { url: string; area: number }[] = [];
  const imgTag = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgTag.exec(html))) {
    const tag = match[0];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    // Only remote images render directly; skip cid: attachments and data: URIs.
    if (!src || !/^https?:\/\//i.test(src)) continue;
    const w = readDimension(tag, 'width');
    const h = readDimension(tag, 'height');
    if ((w !== null && w <= TRACKING_MAX_PX) || (h !== null && h <= TRACKING_MAX_PX)) continue;
    candidates.push({ url: src, area: (w ?? 0) * (h ?? 0) });
  }
  if (candidates.length === 0) return null;
  // Stable sort keeps document order among equal/undeclared sizes → first wins.
  candidates.sort((a, b) => b.area - a.area);
  return candidates[0].url;
}

// Gmail snippets arrive HTML-entity encoded; decode the common ones.
function decodeSnippet(snippet: string): string {
  return snippet
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export type InboxQuery = {
  maxResults?: number;
  pageToken?: string;
  /** Gmail search query (the `q` param). When set, searches the whole mailbox. */
  query?: string;
  /** Label to list when there's no search query (default `INBOX`; `SENT` etc). */
  labelId?: string;
};

/**
 * List message IDs (newest first). With no `query` this lists the given label
 * (default INBOX); with a `query` it runs a Gmail search (`q` param).
 */
export async function listInboxMessageIds(
  token: string,
  { maxResults = 20, pageToken, query, labelId = 'INBOX' }: InboxQuery = {},
): Promise<{ ids: { id: string; threadId: string }[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set('q', query);
  else params.set('labelIds', labelId);
  if (pageToken) params.set('pageToken', pageToken);
  const data = await gmailFetch<ListResponse>(token, `/messages?${params.toString()}`);
  return { ids: data.messages ?? [], nextPageToken: data.nextPageToken };
}

/**
 * Fetch a single message and build a displayable row. Uses `format=full` (one
 * request) so we get the headers, snippet, and the HTML body — the latter feeds
 * the thumbnail picker (TODO #7).
 */
export async function getMessageMetadata(token: string, id: string): Promise<GmailMessage> {
  const params = new URLSearchParams({ format: 'full' });
  const msg = await gmailFetch<MessageResponse>(token, `/messages/${id}?${params.toString()}`);
  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: decodeSnippet(msg.snippet ?? ''),
    subject: header(msg, 'Subject') || '(no subject)',
    from: header(msg, 'From'),
    date: header(msg, 'Date'),
    thumbnailUrl: extractThumbnailUrl(findPartBody(msg.payload, 'text/html')),
    bodyText: extractBodyText(msg.payload),
    unread: (msg.labelIds ?? []).includes('UNREAD'),
  };
}

export type GmailMessageContent = {
  id: string;
  subject: string;
  from: string;
  date: string;
  /** Full HTML body, or '' when the message has no HTML part. */
  html: string;
  /** Plain-text body, used as a fallback when there's no HTML. */
  text: string;
  /** Full cleaned plain-text body, used by the RAG chat (see TODO #13). */
  bodyText: string;
};

/** Mark a message as read by removing Gmail's `UNREAD` label (see TODO #11). */
export async function markMessageRead(token: string, id: string): Promise<void> {
  await gmailFetch(token, `/messages/${id}/modify`, {
    method: 'POST',
    body: { removeLabelIds: ['UNREAD'] },
  });
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
};

// Encode a header value containing non-ASCII as an RFC 2047 "encoded-word" so
// unicode subjects survive transport.
function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const encode = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (!encode) return value;
  return `=?UTF-8?B?${encode(utf8ToBytes(value))}?=`;
}

/** Send a plain-text email from the signed-in user (Compose). */
export async function sendEmail(token: string, email: OutgoingEmail): Promise<void> {
  const headers = [
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ];
  const raw = encodeBase64Url(`${headers.join('\r\n')}\r\n\r\n${email.body}`);
  await gmailFetch(token, '/messages/send', { method: 'POST', body: { raw } });
}

/** Fetch a single message's full content (HTML body + headers) for the reader. */
export async function getMessageContent(token: string, id: string): Promise<GmailMessageContent> {
  const params = new URLSearchParams({ format: 'full' });
  const msg = await gmailFetch<MessageResponse>(token, `/messages/${id}?${params.toString()}`);
  return {
    id: msg.id,
    subject: header(msg, 'Subject') || '(no subject)',
    from: header(msg, 'From'),
    date: header(msg, 'Date'),
    html: findPartBody(msg.payload, 'text/html'),
    text: findPartBody(msg.payload, 'text/plain') || decodeSnippet(msg.snippet ?? ''),
    bodyText: extractFullBody(msg.payload),
  };
}

// Resolve an array with a bounded number of in-flight promises, preserving order.
// Gmail caps concurrent per-user requests, so we never fire a whole page at once.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Max simultaneous message fetches — kept low to avoid Gmail's "too many
// concurrent requests" rate limit (especially with the Inbox + Sent tabs both live).
const FETCH_CONCURRENCY = 4;

/**
 * Convenience: list one page of the inbox (or search results, when `query` is
 * set) and resolve each message's metadata.
 */
export async function fetchInbox(
  token: string,
  options: InboxQuery = {},
): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
  const { ids, nextPageToken } = await listInboxMessageIds(token, options);
  const messages = await mapWithConcurrency(ids, FETCH_CONCURRENCY, (m) =>
    getMessageMetadata(token, m.id),
  );
  return { messages, nextPageToken };
}
