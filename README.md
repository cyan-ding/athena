# Athena

> **The AI-Native Bloomberg Terminal**
> Institutional-grade investment intelligence for everyone.

Athena is an AI-powered trading platform that combines real-time market data, SEC filing analysis, social sentiment, and paper trading into a single conversational interface. Ask questions in plain English, get answers backed by multiple sources, and execute trades—all in one place.

---

## The Problem

Modern retail traders juggle multiple tools:
- **Bloomberg Terminal** for institutional research ($24,000/year)
- **TradingView** for charts and technicals
- **SEC EDGAR** for company filings (raw, unreadable documents)
- **Reddit/Twitter** for sentiment and crowdsourced alpha
- **Brokerage apps** for trade execution
- **Google** for connecting the dots

Each tool is siloed. None of them talk to each other. And **none of them remember what you care about**.

---

## The Solution

Athena is a unified AI assistant that:

1. **Answers questions** using hybrid RAG on SEC 10-Ks, real-time web search, and social sentiment
2. **Visualizes markets** with interactive price charts and time-range selection
3. **Executes trades** via Alpaca's paper trading API (no real money at risk)
4. **Remembers everything** using Hyperspell's semantic memory layer
5. **Cites sources** with proper attribution to EDGAR filings, news articles, and social posts

Ask "Why did NVDA spike in Q2 2023?" and get a synthesized answer from earnings reports, analyst coverage, and Reddit sentiment—**with citations**.

---

## Key Features

### 1. Conversational Market Intelligence
Ask questions in plain English. Athena gathers context from:
- **Perplexity API** - Real-time web search for breaking news and analyst reports
- **SEC EDGAR** - Company fundamentals from 10-K/10-Q filings (RAG-powered)
- **Browser-Use** - Social sentiment from Reddit and Twitter/X
- **Hyperspell** - Your personal trading history and past decisions

All answers include **cited sources** organized by type (EDGAR filings, web articles, social posts).

### 2. Hybrid RAG on SEC Filings
Don't read 200-page 10-Ks. Ask Athena instead.

Our RAG system uses:
- **Vector search** for semantic similarity (embeddings via OpenAI)
- **Keyword search** for exact phrase matching (BM25-style text search)
- **Reciprocal Rank Fusion (RRF)** to combine both approaches
- **2000-character chunks** with 400-character overlap to preserve financial context

Ask "What are NVDA's main risks?" and get answers from the actual Risk Factors section—**not hallucinations**.

### 3. Interactive Price Charts
- Live candlestick charts powered by Lightweight Charts
- Multiple timeframes: 1D, 1W, 1M, 3M, 6M, 1Y
- Select time ranges directly on the chart
- Historical data with infinite scroll

### 4. Paper Trading Integration
- Execute **market** and **limit orders** via Alpaca's paper trading API
- Track positions, account balance, and buying power
- View trade history with entry/exit prices
- All trades logged to memory for AI analysis

### 5. Memory-Aware Assistant
Athena uses **Hyperspell** to remember:
- Questions you've asked about specific stocks
- Trades you've executed (with rationale)
- AI recommendations you've received
- Your risk profile and trading patterns

Future queries reference past context: *"You asked about NVDA two weeks ago—you bought 100 shares at $485. It's now $515 (+6.2%)."*

### 6. Watchlist & Portfolio Management
- Custom watchlist (up to 5 stocks)
- One-click ticker switching
- Real-time position tracking
- Portfolio dashboard with unrealized P&L

---

## Tech Stack

### Frontend
- **Next.js 16** - Full-stack React framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lightweight Charts** - Performant candlestick charts
- **Radix UI** - Accessible component primitives

### Backend & Database
- **Convex** - Real-time database with built-in vector and text search
- **Better Auth** - Modern authentication system
- **Next.js API Routes** - Serverless endpoints

### AI & NLP
- **OpenAI GPT-4 Turbo** - Answer synthesis and reasoning
- **Perplexity API** - Real-time web search
- **Hyperspell** - Semantic memory layer
- **LangChain** - Document processing and text splitting

### Trading & Market Data
- **Alpaca Trade API** - Paper trading execution
- **Polygon.io** - Historical and real-time market data
- **SEC EDGAR API** - Company filings (10-K, 10-Q, 8-K)

### Browser Automation
- **Browser-Use** - Python FastAPI microservice for social media scraping
- Sentiment analysis from Reddit and Twitter/X

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ (for Browser-Use microservice)
- API keys for:
  - [Convex](https://convex.dev)
  - [OpenAI](https://platform.openai.com)
  - [Perplexity](https://www.perplexity.ai)
  - [Alpaca](https://alpaca.markets) (paper trading)
  - [Polygon.io](https://polygon.io)
  - [Hyperspell](https://hyperspell.com) (optional)
  - [Browser-Use](https://browser-use.com) (optional, $10 free credit)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/athena.git
cd athena
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Edit .env.local and add your API keys
```

Required variables:
```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# OpenAI
OPENAI_API_KEY=sk-...

# Perplexity
PERPLEXITY_API_KEY=pplx-...

# Alpaca (Paper Trading)
ALPACA_API_KEY=PK...
ALPACA_SECRET_KEY=...
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Polygon.io
POLYGON_API_KEY=...

# Better Auth
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
SITE_URL=http://localhost:3000

# Optional: Hyperspell (for memory)
HYPERSPELL_API_KEY=...

# Optional: Browser-Use (for social sentiment)
BROWSERUSE_API_KEY=...
```

4. **Deploy Convex schema**
```bash
npx convex dev
```

This creates the necessary tables and indexes for:
- User authentication (Better Auth)
- SEC filing chunks (vector + text search)
- Price alerts and trading history

5. **Start the development server**
```bash
npm run dev
```

6. **(Optional) Start Python microservice for social scraping**
```bash
cd python-service
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -e .
uvx browser-use install  # Install Chromium
python main.py
```

The Python service runs on `http://localhost:8001` and provides Reddit/Twitter scraping.

### First Steps

1. **Sign up** at `http://localhost:3000`
2. **Search for a ticker** (e.g., "NVDA")
3. **Ingest SEC filings** - Click "Load 10-K" to enable RAG on company filings
4. **Ask questions** - "What are the main risk factors?"
5. **Execute a paper trade** - Use the Trading Panel to buy/sell

---

## Usage Examples

### Example 1: Understanding a Price Movement
```
User: "Why did NVDA spike between April and June 2023?"

Athena: Based on multiple sources:

📊 SEC EDGAR (10-Q Filing):
- Q1 2023 revenue up 19% YoY driven by data center demand
- Data center revenue: $4.28B (+14% YoY)

🌐 Web Sources:
- Jensen Huang announced new H100 GPUs at GTC 2023 (March 21)
- Microsoft, Google, AWS signed major cloud contracts
- ChatGPT boom drove unprecedented AI chip demand

📱 Social Sentiment:
- Reddit r/wallstreetbets: 847 mentions (87% positive)
- Top post: "NVDA to the moon - AI revolution just started"

Sources: [10-Q Filing], [Bloomberg], [TechCrunch], [Reddit]
```

### Example 2: Company Fundamentals
```
User: "What are TSLA's main revenue sources?"

Athena: According to TSLA's latest 10-K:

1. Automotive Sales (81% of revenue)
   - Model 3/Y: $67.2B
   - Model S/X: $7.8B

2. Energy Generation & Storage (6%)
   - Solar: $3.9B
   - Powerwall/Megapack: $2.1B

3. Services & Other (13%)
   - Supercharging network
   - Vehicle insurance
   - FSD subscriptions

Source: [TSLA 10-K 2023, Item 7]
```

### Example 3: Memory-Aware Trading
```
User: "Should I sell my NVDA position?"

Athena: Context from your trading history:
- You bought 50 shares at $485.30 on Oct 15, 2024
- Current price: $515.80 (+6.3%)
- Unrealized gain: $1,525

Based on current analysis:
- NVDA up 12% this week on strong H100 demand
- Analysts raised PT to $600 (avg)
- Social sentiment: 82% bullish

Your typical pattern: You tend to take profits at +15% gains.

Recommendation: Consider scaling out 50% now, let rest run with trailing stop at +5%.

[This is paper trading advice - not financial advice]
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/market-data` | GET | Fetch OHLCV data (Polygon.io) |
| `/api/ai/chat` | POST | Main AI chat with streaming |
| `/api/ai/perplexity` | POST | Web search for current info |
| `/api/ai/edgar` | GET | List SEC filings for ticker |
| `/api/ai/edgar/ingest` | POST | Ingest & chunk 10-K documents |
| `/api/ai/edgar/query` | POST | RAG query on filings |
| `/api/ai/social` | POST | Social sentiment scraping |
| `/api/trading/order` | POST | Place market/limit orders |
| `/api/trading/positions` | GET | Current holdings |
| `/api/trading/account` | GET | Account balance |
| `/api/trading/history` | GET | Trade history |

---

## Architecture

### Data Flow

```
User Question
    ↓
Main Chat API (/api/ai/chat)
    ↓
┌─────────────────────────────────────────┐
│  Parallel Context Gathering             │
│  ├─ Perplexity (web search)             │
│  ├─ EDGAR RAG (vector + keyword search) │
│  ├─ Browser-Use (social sentiment)      │
│  └─ Hyperspell (user memory)            │
└─────────────────────────────────────────┘
    ↓
GPT-4 Turbo (synthesize answer)
    ↓
Stream response with citations
    ↓
Store interaction in Hyperspell
```

### RAG Pipeline

```
10-K Document (EDGAR API)
    ↓
Section Extraction (regex)
    ↓
Text Splitting (LangChain)
    ├─ 2000 char chunks
    └─ 400 char overlap
    ↓
Generate Embeddings (OpenAI)
    ↓
Store in Convex
    ├─ Vector index (semantic search)
    └─ Text index (keyword search)
    ↓
User Query
    ↓
Hybrid Search
    ├─ Vector similarity search
    ├─ Keyword text search
    └─ RRF merge (best of both)
    ↓
Top 5 chunks → GPT-4 for synthesis
```

---

## Roadmap

### Phase 1: Core Intelligence (✅ Complete)
- [x] Interactive price charts
- [x] AI chat with streaming responses
- [x] Hybrid RAG on SEC filings
- [x] Perplexity web search integration
- [x] Paper trading (Alpaca)
- [x] Hyperspell memory layer

### Phase 2: Email & Alerts (In Progress)
- [x] AgentMail integration
- [x] Email webhook handling
- [x] Price alert sending
- [ ] Daily digest emails
- [ ] Reply-to-trade functionality

### Phase 3: Voice & Collaboration
- [ ] LiveKit voice mode integration
- [ ] Real-time collaborative annotations
- [ ] Shared watchlists and portfolios
- [ ] Team chat rooms

### Phase 4: Advanced Analytics
- [ ] Custom technical indicators
- [ ] Portfolio backtesting
- [ ] Risk analysis dashboard
- [ ] Sector exposure heat maps

### Phase 5: Production
- [ ] Real trading (live Alpaca API)
- [ ] Multi-broker support
- [ ] Mobile app (React Native)
- [ ] Enterprise tier (teams, compliance)

---

## Project Structure

```
athena/
├── src/
│   ├── app/
│   │   ├── api/               # Next.js API routes
│   │   │   ├── ai/            # AI endpoints (chat, perplexity, edgar)
│   │   │   ├── trading/       # Alpaca trading endpoints
│   │   │   ├── auth/          # Better Auth routes
│   │   │   └── market-data/   # Polygon.io data fetching
│   │   └── page.tsx           # Main app UI
│   ├── components/            # React components
│   │   ├── PriceChart.tsx     # Lightweight Charts wrapper
│   │   ├── PortfolioDashboard.tsx
│   │   └── TradingPanel.tsx
│   └── lib/                   # Utility libraries
│       ├── alpaca.ts          # Alpaca client
│       ├── hyperspell.ts      # Hyperspell client
│       └── auth.ts            # Better Auth config
├── convex/                    # Convex backend
│   ├── schema.ts              # Database schema
│   ├── secFilings.ts          # RAG queries
│   ├── paperTrades.ts         # Trade tracking
│   └── auth.ts                # Better Auth integration
├── python-service/            # Browser-Use microservice
│   └── main.py                # FastAPI server
└── public/                    # Static assets
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details

---

## Acknowledgments

Built with:
- [Convex](https://convex.dev) - Real-time database
- [OpenAI](https://openai.com) - GPT-4 language models
- [Perplexity](https://www.perplexity.ai) - Real-time search
- [Hyperspell](https://hyperspell.com) - Semantic memory
- [Alpaca](https://alpaca.markets) - Commission-free trading API
- [Browser-Use](https://browser-use.com) - Browser automation

---

## Support

Questions? Issues? Reach out:
- GitHub Issues: [Create an issue](https://github.com/yourusername/athena/issues)
- Email: your-email@example.com

---

**Disclaimer**: Athena is for educational and research purposes. Paper trading only. Not financial advice. Trade at your own risk.
