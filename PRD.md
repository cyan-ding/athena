Product Requirements Document (PRD)
Project Title:

Athena – The AI-Native Bloomberg Terminal

Overview:

Athena is an AI-driven, multimodal investment intelligence platform designed to give retail and professional traders Bloomberg-level insights at a fraction of the cost. It aggregates financial, alternative, and sentiment data from sources like Polygon.io, SEC filings, and market APIs, contextualizes that data through natural language queries, and enables real-time, conversational portfolio management.

The system leverages cutting-edge YC tools to deliver automated research, personalized digests, and voice-assisted trading insights.

Goals:

Democratize access to institutional-grade financial analytics.

Use AI to make financial data conversational — users can ask about companies, time periods, or anomalies in price charts and get contextual, sourced answers.

Deliver real-time insights via both chat and voice interactions.

Automate communication and reporting to help users stay on top of opportunities and portfolio risks.

Key Features:
1. Unified Market Intelligence Hub

Aggregate real-time and historical market data (via Polygon API).

Include SEC filings, earnings reports, corporate events, and sentiment data.

Use Convex as a backend data layer for seamless real-time syncing between sources, user data, and AI insights.

2. AI Query Engine

Built on Perplexity for retrieval-augmented reasoning and sourced explanations.

Allows users to ask:

“Why did $NVDA spike between April 2023 and June 2023?”

“What do analysts predict for $TSLA’s Q4 earnings?”

“How did interest rate changes affect the energy sector last month?”

Uses Hyperspell to perform vector search across filings, transcripts, and news articles to ensure contextual answers.

3. Interactive Chart + Contextual AI

Users can select a time region on a price chart and ask the AI questions like:

“Explain this dip.”

“What catalysts were active here?”

The platform uses metadata from the Polygon API (events, filings, news, earnings) to generate a timeline and explain the event.

4. Email & Digest Automation (AgentMail Integration)

AgentMail automatically generates:

Weekly investor digests: Summarizing portfolio performance, key macro trends, and earnings events.

Intra-day alerts: “$NVDA up 5% after earnings beat – view analysis.”

Users can toggle frequency and customize content type (macro, technical, or company-specific).

5. Voice Mode (LiveKit Integration)

LiveKit enables low-latency voice chat:

“Hey Athena, tell me what’s happening with $AAPL today.”

“Show me the recent SEC filings for $PLTR.”

“Add this to my watchlist.”

Converts speech → text → command → AI action pipeline for hands-free insights.

6. AI Workflow Automation (Browser-Use + Moss Integration)

Browser-Use: Allows Athena’s backend agents to autonomously fetch or verify new web data (e.g., “fetch the latest 10-K for NVDA from SEC.gov” or “get the top Reddit posts about $GME”).

Moss: Manages agentic workflows, ensuring consistency and preventing redundant or unsafe automation actions.

Tech Stack:
Layer	Technology
Frontend	Next.js + Tailwind + LiveKit SDK + D3/Recharts
Backend	Convex.dev (real-time sync, user data storage)
AI Layer	OpenAI GPT + Perplexity + Hyperspell + Moss (semantic search)
Data Layer	Polygon.io API + Browser-Use (live scraping sites such as reddit/x)
Communication	AgentMail (email automation), LiveKit (voice interface)
