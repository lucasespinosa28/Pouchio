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
 - [x] reply from the reader — "✨ Reply" in the reader drafts replies on-device and opens Send prefilled (To / `Re:` subject / quoted body)
 - [ ] enable sending: add the `gmail.send` scope to the OAuth consent screen, then sign out/in so the token gets it
 - [ ] reader needs a native build: `bunx expo prebuild -p ios && bunx expo run:ios --device`
 - [ ] cleanup (optional): dead `mailbox: 'sent'` path in use-gmail/gmail-inbox, plus unused `Collapsible`, `WebBadge`, `explore.png`

## Note
 - #12 (expanded summary in the opened email) was built then removed by request; `expandSummary` is gone

## Backlog / possible features

High value (reuses existing local model + embeddings):
 - [x] semantic search — search inbox by meaning using the GTE-Large embeddings already loaded for RAG (on-device, ranks the loaded inbox; whole-mailbox keyword search kept as the other mode)
 - [x] smart replies in the reader — local model drafts 2–3 reply options → tap one to open Send prefilled (also closes the reply gap above)
 - [x] local auto-triage labels — classify each email on-device (Priority / Newsletter / Receipt / Social) and show a chip on the card

Gmail gaps:
 - [ ] more swipe actions — archive / delete / star
 - [ ] attachments — list + download/preview in the reader
 - [ ] CC/BCC + attachments in the Send tab
 - [ ] conversation/threading view (group a thread instead of separate cards)
 - [ ] push notifications for new mail

AI extras:
 - [x] "summarize my unread" one-tap digest — ✨ pill in the inbox → on-device digest of loaded unread mail
 - [x] extract action items / dates from an email — "Action items" in the reader's ✨ AI menu
 - [x] translate email / adjust draft tone (formal ↔ casual) — "Translate" in the reader's ✨ AI menu; tone chips in the Send tab
 - [x] editable draft + reply prompts in Settings (extend the existing prompt-editing pattern)

## QVAC Hackathon I readiness (see hackthon.md)
Verdict: **core requirement MET** — all AI inference (completion + embeddings/RAG)
runs on-device via `@qvac/sdk`, no cloud AI. Good fit for the **Mobile** track
(also qualifies for General Purpose, retail phone ≤32 GB). Several submission
artifacts are still outstanding. ⚠️ Deadline: **2026-06-21 23:59 UTC** (early-bird
before Jun 17 already passed).

Already satisfied:
 - [x] all inference via QVAC SDK — LLAMA_3_2_1B_INST_Q4_0 (completion) + GTE_LARGE_FP16 (embeddings); powers summaries, triage, semantic search, RAG chat, replies, action items, translate, digest, tone
 - [x] fully on-device / privacy-first mobile app (Mobile track focus: local summarization, translator, personal assistant)
 - [x] retail-device only (iOS/Android via Expo); no custom/embedded hardware
 - [x] clear README with setup instructions
 - [x] only non-AI cloud use is Gmail (read/send) + Google Sign-In — allowed if disclosed

Still required to submit:
 - [x] **license → Apache 2.0** — LICENSE replaced with Apache 2.0 (Copyright 2026 Pouchio); `package.json` license field + README License section added
 - [x] **remote-API disclosure file** (json/yaml/xml) listing every remote call: Gmail REST (`gmail.googleapis.com`) + Google OAuth / Sign-In endpoints
 - [x] **auditable performance log** (csv/json) for a standard demo run: model loads/unloads + per-inference prompt, tokens, **TTFT**, **tokens/sec** — current logging only records char counts, so this needs real token/timing instrumentation + export
 - [x] **reproducibility instructions + hardware specs** (CPU/GPU/RAM/storage) with system-profiler screenshots
 - [x] **demo video** — YouTube unlisted, ≤5 min, showing the app + results
 - [x] **public GitHub repo** accessible to judges, Apache 2.0 for the hackathon period
 - [x] **DoraHacks** registration + project page listing all team members
 - [x] **join the QVAC Discord** community
 - [x] **prior-work disclosure** — judging counts only Jun 1–21 work; disclose anything predating the build period (repo is currently one "Initial commit")
 - [x] assemble the **evidence bundle** for the 3-stage verification
