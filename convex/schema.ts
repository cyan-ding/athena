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
});
