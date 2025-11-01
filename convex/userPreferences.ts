import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's preferences
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return prefs;
  },
});

// Update user preferences (upsert)
export const update = mutation({
  args: {
    userId: v.string(),
    defaultTimeRange: v.optional(v.string()),
    defaultTicker: v.optional(v.string()),
    useBrowserUse: v.optional(v.boolean()),
    showCitations: v.optional(v.boolean()),
    theme: v.optional(v.string()),
    enableNotifications: v.optional(v.boolean()),
    enableAutoTrading: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, ...preferences } = args;

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Filter out undefined values
    const filteredPrefs = Object.fromEntries(
      Object.entries(preferences).filter(([_, v]) => v !== undefined)
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...filteredPrefs,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userPreferences", {
        userId,
        ...filteredPrefs,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reset preferences to defaults
export const reset = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
