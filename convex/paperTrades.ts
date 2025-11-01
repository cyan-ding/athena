import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new paper trade
export const createTrade = mutation({
  args: {
    userId: v.string(),
    alpacaOrderId: v.string(),
    ticker: v.string(),
    side: v.union(v.literal("buy"), v.literal("sell")),
    quantity: v.number(),
    orderType: v.string(),
    entryPrice: v.number(),
    limitPrice: v.optional(v.number()),
    stopPrice: v.optional(v.number()),
    status: v.string(),
    rationale: v.optional(v.string()),
    aiRecommendation: v.optional(v.boolean()),
    userQuestion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tradeId = await ctx.db.insert("paperTrades", {
      ...args,
      createdAt: Date.now(),
    });
    return tradeId;
  },
});

// Update trade status (e.g., filled, closed)
export const updateTradeStatus = mutation({
  args: {
    tradeId: v.id("paperTrades"),
    status: v.string(),
    executedAt: v.optional(v.number()),
    exitPrice: v.optional(v.number()),
    pnl: v.optional(v.number()),
    pnlPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tradeId, ...updates } = args;
    await ctx.db.patch(tradeId, {
      ...updates,
      ...(args.status === "closed" && { closedAt: Date.now() }),
    });
  },
});

// Get all trades for a user
export const getUserTrades = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const trades = await ctx.db
      .query("paperTrades")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return trades;
  },
});

// Get open positions for a user
export const getOpenPositions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const trades = await ctx.db
      .query("paperTrades")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.or(q.eq(q.field("status"), "filled"), q.eq(q.field("status"), "open")))
      .order("desc")
      .collect();
    return trades;
  },
});

// Get trade history for a specific ticker
export const getTickerTrades = query({
  args: { userId: v.string(), ticker: v.string() },
  handler: async (ctx, args) => {
    const trades = await ctx.db
      .query("paperTrades")
      .withIndex("by_user_ticker", (q) => q.eq("userId", args.userId).eq("ticker", args.ticker))
      .order("desc")
      .collect();
    return trades;
  },
});

// Log trading memory/context
export const logTradingMemory = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
    ticker: v.optional(v.string()),
    content: v.string(),
    hyperspellId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const memoryId = await ctx.db.insert("tradingMemory", {
      ...args,
      createdAt: Date.now(),
    });
    return memoryId;
  },
});

// Get trading memory for context
export const getTradingMemory = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const memories = await ctx.db
      .query("tradingMemory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return memories;
  },
});
