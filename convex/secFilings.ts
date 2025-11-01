/**
 * Convex functions for SEC filing RAG operations
 */

import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Store SEC filing chunks with embeddings
 */
export const storeFilingChunks = mutation({
  args: {
    chunks: v.array(
      v.object({
        ticker: v.string(),
        cik: v.string(),
        formType: v.string(),
        filingDate: v.string(),
        accessionNumber: v.string(),
        section: v.string(),
        chunkIndex: v.number(),
        text: v.string(),
        embedding: v.array(v.float64()),
        url: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];

    for (const chunk of args.chunks) {
      const id = await ctx.db.insert("secFilingChunks", {
        ...chunk,
        createdAt: Date.now(),
      });
      ids.push(id);
    }

    return { count: ids.length, ids };
  },
});

/**
 * Check if a filing has already been processed
 */
export const isFilingProcessed = query({
  args: {
    ticker: v.string(),
    accessionNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("secFilingChunks")
      .withIndex("by_filing", (q) =>
        q.eq("ticker", args.ticker).eq("accessionNumber", args.accessionNumber)
      )
      .first();

    return !!existing;
  },
});

/**
 * Helper query to get chunk by ID
 */
export const getChunk = query({
  args: { id: v.id("secFilingChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Vector search for relevant SEC filing chunks
 */
export const searchFilingChunks = action({
  args: {
    ticker: v.string(),
    embedding: v.array(v.float64()),
    formType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    // Perform vector search
    const results = await ctx.vectorSearch("secFilingChunks", "by_embedding", {
      vector: args.embedding,
      limit: args.formType ? limit * 3 : limit,
      filter: (q) => q.eq("ticker", args.ticker),
    });

    // Fetch full document data for each result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunks: any[] = await Promise.all(
      results.map(async (result) => {
        const chunk = await ctx.runQuery(api.secFilings.getChunk, {
          id: result._id,
        });
        return chunk ? { ...chunk, score: result._score } : null;
      })
    );

    // Filter out nulls and apply formType filter if needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validChunks = chunks.filter((c: any) => c !== null);
    if (args.formType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return validChunks.filter((c: any) => c.formType === args.formType).slice(0, limit);
    }

    return validChunks;
  },
});

/**
 * Get all filings for a ticker (for admin/debugging)
 */
export const getFilingsForTicker = query({
  args: {
    ticker: v.string(),
    formType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("secFilingChunks").withIndex("by_ticker", (q) =>
      q.eq("ticker", args.ticker)
    );

    if (args.formType) {
      const formType = args.formType; // Extract to ensure TypeScript knows it's defined
      q = ctx.db.query("secFilingChunks").withIndex("by_ticker_form", (q) =>
        q.eq("ticker", args.ticker).eq("formType", formType)
      );
    }

    const chunks = await q.collect();

    // Define filing summary type
    interface FilingSummary {
      ticker: string;
      cik: string;
      formType: string;
      filingDate: string;
      accessionNumber: string;
      url: string;
      chunkCount: number;
    }

    // Group by filing
    const filings = chunks.reduce((acc, chunk) => {
      const key = chunk.accessionNumber;
      if (!acc[key]) {
        acc[key] = {
          ticker: chunk.ticker,
          cik: chunk.cik,
          formType: chunk.formType,
          filingDate: chunk.filingDate,
          accessionNumber: chunk.accessionNumber,
          url: chunk.url,
          chunkCount: 0,
        };
      }
      acc[key].chunkCount++;
      return acc;
    }, {} as Record<string, FilingSummary>);

    return Object.values(filings);
  },
});

/**
 * Delete all chunks for a specific filing (for re-processing)
 */
export const deleteFilingChunks = mutation({
  args: {
    ticker: v.string(),
    accessionNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("secFilingChunks")
      .withIndex("by_filing", (q) =>
        q.eq("ticker", args.ticker).eq("accessionNumber", args.accessionNumber)
      )
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    return { deleted: chunks.length };
  },
});
