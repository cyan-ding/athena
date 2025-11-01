Implementation Roadmap — minimum viable core (step-by-step)

Nice — below is a focused, actionable sequence of fundamental features to build first so you get a working, demo-ready “AI-native Bloomberg” MVP that showcases chart highlighting → contextual reasoning, portfolio awareness, realtime sync, voice, and email. I order by importance and dependency (what unlocks what). I also give concrete subtasks, owner roles, and success criteria for each step so your 3-person team can run with it.

Phase 0 — Setup (must do before feature work)

Create repo, CI, and deploy preview (Vercel / Netlify).

Provision services / keys (Convex.dev project; Polygon dev key; accounts or sandbox keys for Perplexity, Hyperspell, Moss, AgentMail, LiveKit, Browser-Use).

Define environment / secrets store and basic logging.

Wire basic auth (OAuth or email) and user model with Convex.

Deliverable: Working app shell, login, and Convex connection.
Success: Team can push preview links; each dev can run frontend/backend locally.

Phase 1 — Core data + real-time state (foundational)

Purpose: get tickers, historical bars, and live sharing working. Everything else reads from here.

Integrate Polygon (price/time series)

Implement serverless fetching of historical OHLCV bars and snapshots. Cache in Convex for selected tickers.

Expose a frontend endpoint to request bars for a ticker + range.

Convex real-time backend state

Store user portfolios/watchlists, chart annotations, and chat sessions in Convex.

Implement subscriptions so frontend updates instantly when state changes.

Frontend charting + highlight UI

Add an interactive chart component (lightweight TradingView widget / Plotly / Recharts).

Implement drag-to-select time window that returns start/end timestamps to the app.

Deliverable: User can view a chart and select a time range; selection is synced across collaborators (Convex).
Success: Selection persists in Convex and updates other clients in same session.

Phase 2 — Retrieval pipeline & fast context (enables chart Q&A)

Purpose: answer “why did this happen?” for any selected region.

Index seed corpus & Moss integration

Ingest a compact corpus: recent news headlines, earnings dates, and parsed SEC filing metadata (not full text yet).

Create embeddings and store them in Moss (or your chosen vector store via Moss SDK).

Build API to query Moss by time window + ticker to return top N relevant items.

Perplexity / web retrieval fallback

Wire Perplexity to perform web searches when Moss returns insufficient context. Return ranked texts/URLs.

RAG orchestration

Implement a server endpoint: input = ticker + time window + optional user portfolio context → steps:

Query Moss for relevant documents (time-filtered).

If low confidence, query Perplexity.

Aggregate results and pass to LLM to generate a concise summary with citations.

LLM summarizer

Use an LLM (your choice) to transform retrieval results into a short explanation and timeline (bulleted events + sources).

Deliverable: When user highlights a region and clicks “Explain,” the system returns a short reasoning timeline with links.
Success: Explanations cite 2–3 sources and mention specific events (earnings, guidance, news).

Phase 3 — Portfolio awareness & personalization

Purpose: answers are portfolio-aware and your app can reason about user positions.

Portfolio import / manual entry

Allow CSV upload and simple manual add of positions (ticker, shares, avg price). Store in Convex.

Context injection

When running RAG+LLM, inject user position info (only if user allows) so answers can be personalized (“This dip caused a 4% portfolio drawdown”).

Basic risk / exposure widget

Calculate sector exposure, unrealized PnL, and contribution to portfolio volatility (simple metrics). Display on dashboard.

Deliverable: AI answers include portfolio impact lines when relevant (e.g., “This caused −$X in PnL”).
Success: Users can see tailored context and watchlist items in generated summaries.

Phase 4 — Email alerts & AgentMail integration

Purpose: push value outside the app to capture busy users.

Digest engine

Create a templating system for daily/weekly digests (top movers, portfolio summary, high-confidence AI-flagged events).

Intraday alert triggers

Add rule engine examples (price move >X%, earnings surprise, volume spike). When triggered, create a short AI summary.

AgentMail integration

Hook up AgentMail to send generated digests and intraday emails; include direct CTA links back to the app and “reply to ask” info. Implement basic unsubscribe / settings.

Deliverable: User can opt into email digests and receive intraday AI summaries.
Success: Emails contain relevant links and allow simple reply-to ask.

Phase 5 — Voice mode (LiveKit) and conversational interaction

Purpose: enable low-friction, hands-free querying and demos.

LiveKit session integration

Add a simple “Voice Mode” toggle that joins a LiveKit room and streams audio.

Speech→Intent pipeline

Use LiveKit or an STT service to transcribe. Map natural queries (e.g., “Why did X dip?”) to existing RAG endpoints.

TTS for responses

Return spoken answers and show the text. Keep responses short or provide “read more” links.

Deliverable: User toggles voice, asks a question, receives spoken + text answer derived from the RAG pipeline.
Success: Basic voice Q&A flows work reliably in a demo.

Phase 6 — Browser-Use as research fallback & safe usage

Purpose: let agents fetch raw pages when indexed sources aren’t enough.

Whitelist domains & browsing policies

Define a small list of trusted sites: EDGAR, NYTimes/FT (if licensed), Yahoo Finance, Seeking Alpha, major press. Create rate limits.

Browser-Use tasks

Implement agent tasks like “fetch latest 8-K for Ticker between dates” or “scrape top Reddit posts for ticker in window.” Return cleaned text to Moss/LLM.

Human validation step

For any browser-sourced items that are used as primary evidence, flag them for a “source check” before emailing or publishing to user (reduce junk).

Deliverable: Browser-Use can be run on-demand and its results integrated into the RAG answers.
Success: Browser-Use adds new evidence when Moss/Perplexity produce low-confidence results.

Phase 7 — Memory & continuity (Hyperspell)

Purpose: let the agent remember past conversations & user prefs for better personalization.

Store conversation summaries

After key queries, store a brief structured memory (topic, ticker, conclusion, user decision).

Use memories in responses

When user asks repeat/related questions, inject relevant memories into the RAG + LLM prompt so answers are coherent and reference past threads.

Deliverable: The system references prior decisions (“You asked about NVDA two weeks ago; you bought 100 shares then.”)
Success: Repeat queries return contextually consistent answers.

Phase 8 — Polishing, safety, and demo readiness

Add UI/UX polish: clear citation links, source panels, and an “evidence view” to inspect raw docs.

Add rate-limits, telemetry, and basic explainability (“I used these 3 sources”).

Add a small “hallucination check”: cross-verify claims with at least two distinct sources when possible.

Prepare a demo script: highlight → ask → email → voice → collaborative share.

Deliverable: Demo flow runs end-to-end without developer intervention.
Success: Judges can see selection → explanation → email and voice interactions in a 5–7 minute demo.