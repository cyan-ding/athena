import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's portfolio
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return portfolio;
  },
});

// Add or update position
export const upsertPosition = mutation({
  args: {
    userId: v.string(),
    ticker: v.string(),
    shares: v.number(),
    avgPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("portfolios")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      const positions = existing.positions.filter((p) => p.ticker !== args.ticker);
      positions.push({
        ticker: args.ticker,
        shares: args.shares,
        avgPrice: args.avgPrice,
        addedAt: Date.now(),
      });
      await ctx.db.patch(existing._id, { positions });
    } else {
      await ctx.db.insert("portfolios", {
        userId: args.userId,
        positions: [
          {
            ticker: args.ticker,
            shares: args.shares,
            avgPrice: args.avgPrice,
            addedAt: Date.now(),
          },
        ],
      });
    }
  },
});
