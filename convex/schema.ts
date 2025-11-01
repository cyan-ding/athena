import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User portfolios
  portfolios: defineTable({
    userId: v.string(),
    positions: v.array(
      v.object({
        ticker: v.string(),
        shares: v.number(),
        avgPrice: v.number(),
        addedAt: v.number(),
      })
    ),
  }).index("by_user", ["userId"]),

  // Watchlists
  watchlists: defineTable({
    userId: v.string(),
    tickers: v.array(v.string()),
  }).index("by_user", ["userId"]),

  // Chart annotations (for collaborative features)
  chartAnnotations: defineTable({
    userId: v.string(),
    ticker: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ticker", ["ticker"]),

  // Chat sessions
  chatSessions: defineTable({
    userId: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Market data cache (to reduce API calls)
  marketDataCache: defineTable({
    ticker: v.string(),
    timeframe: v.string(), // e.g., "1D", "1W", "1M"
    data: v.string(), // JSON stringified OHLCV data
    cachedAt: v.number(),
  })
    .index("by_ticker", ["ticker"])
    .index("by_ticker_timeframe", ["ticker", "timeframe"]),

  // Paper trades (synced with Alpaca)
  paperTrades: defineTable({
    userId: v.string(),
    alpacaOrderId: v.string(),
    ticker: v.string(),
    side: v.union(v.literal("buy"), v.literal("sell")),
    quantity: v.number(),
    orderType: v.string(), // "market", "limit", "stop", etc.

    // Prices
    entryPrice: v.number(),
    exitPrice: v.optional(v.number()),
    limitPrice: v.optional(v.number()),
    stopPrice: v.optional(v.number()),

    // Status
    status: v.string(), // "open", "filled", "closed", "cancelled", "pending"

    // AI context - why this trade was made
    rationale: v.optional(v.string()),
    aiRecommendation: v.optional(v.boolean()),
    userQuestion: v.optional(v.string()),

    // Performance tracking
    pnl: v.optional(v.number()),
    pnlPercent: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    executedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_ticker", ["userId", "ticker"])
    .index("by_status", ["status"]),

  // Trading memory/context entries (logged to Hyperspell and stored locally)
  tradingMemory: defineTable({
    userId: v.string(),
    type: v.string(), // "trade_decision", "ai_recommendation", "user_question", "market_observation"
    ticker: v.optional(v.string()),
    content: v.string(), // JSON stringified content
    hyperspellId: v.optional(v.string()), // Reference to Hyperspell memory entry
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_ticker", ["ticker"]),

  // SEC filing chunks with vector embeddings for RAG
  secFilingChunks: defineTable({
    // Filing metadata
    ticker: v.string(),
    cik: v.string(),
    formType: v.string(), // "10-K", "10-Q", "8-K"
    filingDate: v.string(), // YYYY-MM-DD
    accessionNumber: v.string(),

    // Content
    section: v.string(), // "Item 1A - Risk Factors", "Item 7 - MD&A", etc.
    chunkIndex: v.number(), // Order within the section
    text: v.string(), // The actual text content

    // Vector embedding (OpenAI text-embedding-3-small = 1536 dimensions)
    embedding: v.array(v.float64()),

    // Metadata
    url: v.string(), // Link to original filing on SEC website
    createdAt: v.number(),
  })
    .index("by_ticker", ["ticker"])
    .index("by_ticker_form", ["ticker", "formType"])
    .index("by_filing", ["ticker", "accessionNumber"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["ticker", "formType", "section"],
    })
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["ticker", "formType", "section"],
    }),

  // User profiles (for BetterAuth and AgentMail)
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  // BetterAuth sessions
  sessions: defineTable({
    sessionToken: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_session_token", ["sessionToken"])
    .index("by_user", ["userId"]),

  // BetterAuth accounts (for password storage)
  accounts: defineTable({
    userId: v.id("users"),
    accountId: v.string(),
    providerId: v.string(),
    password: v.optional(v.string()), // hashed password
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId", "providerId"]),

  // Email threads from AgentMail
  emailThreads: defineTable({
    userId: v.id("users"),
    agentMailThreadId: v.string(),
    subject: v.string(),
    lastMessageAt: v.number(),
    labels: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("awaiting_reply"),
      v.literal("completed")
    ),
  })
    .index("by_user", ["userId"])
    .index("by_thread_id", ["agentMailThreadId"]),

  // Price alerts that trigger email notifications
  priceAlerts: defineTable({
    userId: v.id("users"),
    ticker: v.string(),
    alertType: v.union(
      v.literal("price_up"),
      v.literal("price_down"),
      v.literal("percentage_change")
    ),
    threshold: v.number(), // e.g., 10 for 10% change
    currentPrice: v.number(),
    targetPrice: v.optional(v.number()),

    // Email context
    agentMailThreadId: v.optional(v.string()),
    emailSent: v.boolean(),
    userResponse: v.optional(v.union(v.literal("yes"), v.literal("no"))),

    // Trading action
    suggestedAction: v.union(v.literal("buy"), v.literal("sell"), v.literal("hold")),
    quantity: v.optional(v.number()),
    executed: v.boolean(),
    executedAt: v.optional(v.number()),

    // User behavior context
    behaviorPattern: v.optional(v.string()), // e.g., "User typically sells at +15% profit"

    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("awaiting_response"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("executed"),
      v.literal("expired")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_ticker", ["userId", "ticker"])
    .index("by_status", ["status"]),
});
