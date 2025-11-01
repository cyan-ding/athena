import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's chat sessions
export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return sessions;
  },
});

// Get a specific chat session
export const get = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Create a new chat session
export const create = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("chatSessions", {
      userId: args.userId,
      messages: [],
      createdAt: Date.now(),
    });
    return sessionId;
  },
});

// Add a message to a chat session
export const addMessage = mutation({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    let sessionId = args.sessionId;

    // If no session ID provided, find the most recent session or create a new one
    if (!sessionId) {
      const existingSessions = await ctx.db
        .query("chatSessions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(1);

      if (existingSessions.length > 0) {
        sessionId = existingSessions[0]._id;
      } else {
        // Create new session
        sessionId = await ctx.db.insert("chatSessions", {
          userId: args.userId,
          messages: [],
          createdAt: Date.now(),
        });
      }
    }

    // Get the session
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Add the message
    await ctx.db.patch(sessionId, {
      messages: [
        ...session.messages,
        {
          role: args.role,
          content: args.content,
          timestamp: Date.now(),
        },
      ],
    });

    return sessionId;
  },
});

// Clear a chat session (delete all messages)
export const clear = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      messages: [],
    });
  },
});

// Delete a chat session
export const deleteSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sessionId);
  },
});
