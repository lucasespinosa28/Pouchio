 - [x] add google auth
 - [x] fetch gmail email
 - [x] add pagination to email list
 - [x] add qvac local ai, display in app local model is running
 - [x] turn the email list into a searchable list, if gmail api have search add  it
 - [x] turn the email table into a card
 - [x] create a algorithm to find thunbnail imagen in email body, example the by size image or first
 - [x] use qvc ai to summary the email body,flowchart LR
 - [x] click in the email and opened and display the full email body with images,
 - [x] add a toggle to display read and unread emails
 - [x] add swipe to mark emails as read and to open the email
 - [x] in email page add more complet summary, take the ai summary and expand it with more details
 - [x] add button floating button in opened email to ask something about the email, using docs/rag.md
 - [x] compose and reply to email (gmail send), with a compose screen + reply from the reader

## Still to do / to decide
 - [ ] reply from the reader — only a standalone Send tab was built; no reply action yet (prefill To / `Re:` subject / quoted body)
 - [ ] enable sending: add the `gmail.send` scope to the OAuth consent screen, then sign out/in so the token gets it
 - [ ] reader needs a native build: `bunx expo prebuild -p ios && bunx expo run:ios --device`
 - [ ] cleanup (optional): dead `mailbox: 'sent'` path in use-gmail/gmail-inbox, plus unused `Collapsible`, `WebBadge`, `explore.png`

## Note
 - #12 (expanded summary in the opened email) was built then removed by request; `expandSummary` is gone

## Backlog / possible features

High value (reuses existing local model + embeddings):
 - [ ] semantic search — search inbox by meaning using the GTE-Large embeddings already loaded for RAG
 - [ ] smart replies in the reader — local model drafts 2–3 reply options → tap one to open Send prefilled (also closes the reply gap above)
 - [ ] local auto-triage labels — classify each email on-device (Priority / Newsletter / Receipt / Social) and show a chip on the card

Gmail gaps:
 - [ ] more swipe actions — archive / delete / star
 - [ ] attachments — list + download/preview in the reader
 - [ ] CC/BCC + attachments in the Send tab
 - [ ] conversation/threading view (group a thread instead of separate cards)
 - [ ] push notifications for new mail

AI extras:
 - [ ] "summarize my unread" one-tap digest
 - [ ] extract action items / dates from an email
 - [ ] translate email / adjust draft tone (formal ↔ casual)
 - [ ] editable draft + reply prompts in Settings (extend the existing prompt-editing pattern)
