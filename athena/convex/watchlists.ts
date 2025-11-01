import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's watchlist
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const watchlist = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return watchlist?.tickers || [];
  },
});

// Add ticker to watchlist
export const addTicker = mutation({
  args: {
    userId: v.string(),
    ticker: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      if (!existing.tickers.includes(args.ticker)) {
        await ctx.db.patch(existing._id, {
          tickers: [...existing.tickers, args.ticker],
        });
      }
    } else {
      await ctx.db.insert("watchlists", {
        userId: args.userId,
        tickers: [args.ticker],
      });
    }
  },
});

// Remove ticker from watchlist
export const removeTicker = mutation({
  args: {
    userId: v.string(),
    ticker: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("watchlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tickers: existing.tickers.filter((t) => t !== args.ticker),
      });
    }
  },
});
