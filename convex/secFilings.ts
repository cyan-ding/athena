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
 * Helper query for keyword/text search
 */
export const keywordSearchQuery = query({
  args: {
    ticker: v.string(),
    query: v.string(),
    formType: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Perform text search using Convex search API
    const searchResults = await ctx.db
      .query("secFilingChunks")
      .withSearchIndex("search_text", (q) => {
        let search = q.search("text", args.query);
        if (args.formType) {
          search = search.eq("formType", args.formType);
        }
        return search.eq("ticker", args.ticker);
      })
      .take(args.limit);

    // Return results with synthetic scores based on rank
    return searchResults.map((chunk, index) => ({
      ...chunk,
      score: 1.0 - (index * 0.05), // Descending score based on rank
    }));
  },
});

/**
 * Keyword/text search for SEC filing chunks (action wrapper)
 */
export const keywordSearchFilingChunks = action({
  args: {
    ticker: v.string(),
    query: v.string(),
    formType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const limit = args.limit ?? 5;

    // Call the query to perform text search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = await ctx.runQuery(api.secFilings.keywordSearchQuery, {
      ticker: args.ticker,
      query: args.query,
      formType: args.formType,
      limit: limit * 3, // Get more candidates
    });

    console.log(`[Convex Keyword Search] Got ${results.length} keyword matches`);

    return results.slice(0, limit);
  },
});

/**
 * Hybrid search combining vector similarity and keyword matching
 * Uses Reciprocal Rank Fusion (RRF) to merge results
 */
export const hybridSearchFilingChunks = action({
  args: {
    ticker: v.string(),
    query: v.string(),
    embedding: v.array(v.float64()),
    formType: v.optional(v.string()),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const limit = args.limit ?? 5;

    // Run both searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      // Vector search
      ctx.runAction(api.secFilings.searchFilingChunks, {
        ticker: args.ticker,
        embedding: args.embedding,
        formType: args.formType,
        limit: limit * 2, // Get more candidates for merging
        minScore: args.minScore ?? 0.3,
      }),
      // Keyword search
      ctx.runAction(api.secFilings.keywordSearchFilingChunks, {
        ticker: args.ticker,
        query: args.query,
        formType: args.formType,
        limit: limit * 2, // Get more candidates for merging
      }),
    ]);

    console.log(
      `[Hybrid Search] Vector: ${vectorResults.length}, Keyword: ${keywordResults.length}`
    );

    // Reciprocal Rank Fusion (RRF) algorithm
    // Score = sum of 1/(k + rank) for each result list where item appears
    const k = 60; // RRF constant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoreMap = new Map<string, { chunk: any; rrfScore: number }>();

    // Process vector results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vectorResults.forEach((chunk: any, rank: number) => {
      const id = chunk._id;
      const rrfScore = 1 / (k + rank + 1);
      scoreMap.set(id, {
        chunk: { ...chunk, vectorScore: chunk.score },
        rrfScore,
      });
    });

    // Process keyword results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keywordResults.forEach((chunk: any, rank: number) => {
      const id = chunk._id;
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(id);

      if (existing) {
        // Combine scores if chunk appears in both result sets
        existing.rrfScore += rrfScore;
        existing.chunk.keywordScore = chunk.score;
      } else {
        scoreMap.set(id, {
          chunk: { ...chunk, keywordScore: chunk.score },
          rrfScore,
        });
      }
    });

    // Sort by combined RRF score
    const mergedResults = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map((item) => ({
        ...item.chunk,
        hybridScore: item.rrfScore,
        // Keep original scores for debugging
        score: item.rrfScore, // Use hybrid score as primary score
      }));

    console.log(`[Hybrid Search] Merged to ${mergedResults.length} unique results`);

    return mergedResults.slice(0, limit);
  },
});

/**
 * Enhanced hybrid search with query expansion
 * Generates multiple query variations to improve retrieval
 * Note: Query expansion is handled on the Next.js API side using OpenAI
 */
export const hybridSearchWithExpansion = action({
  args: {
    ticker: v.string(),
    query: v.string(),
    formType: v.optional(v.string()),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const limit = args.limit ?? 5;

    // Note: Query generation happens on the Next.js side via OpenAI API
    // This action receives the original query and will be called multiple times
    // with different query variations from the caller

    // For now, just call the standard hybrid search
    // The query expansion logic will be in the Next.js API route
    return ctx.runAction(api.secFilings.hybridSearchFilingChunks, {
      ticker: args.ticker,
      query: args.query,
      embedding: [], // Will be generated in the caller
      formType: args.formType,
      limit,
      minScore: args.minScore,
    });
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
    minScore: v.optional(v.number()), // Minimum similarity score (0-1)
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const minScore = args.minScore ?? 0.5; // Default threshold of 0.5

    // Perform vector search with higher limit to get more candidates
    const results = await ctx.vectorSearch("secFilingChunks", "by_embedding", {
      vector: args.embedding,
      limit: args.formType ? limit * 5 : limit * 3, // Get more candidates
      filter: (q) => q.eq("ticker", args.ticker),
    });

    console.log(`[Convex Search] Got ${results.length} raw results`);

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
    let validChunks = chunks.filter((c: any) => c !== null);

    // Apply score threshold
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validChunks = validChunks.filter((c: any) => c.score >= minScore);

    console.log(`[Convex Search] After score filter (>=${minScore}): ${validChunks.length} chunks`);

    if (args.formType) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validChunks = validChunks.filter((c: any) => c.formType === args.formType);
      console.log(`[Convex Search] After formType filter: ${validChunks.length} chunks`);
    }

    // Return top results by score, up to limit
    return validChunks.slice(0, limit);
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
