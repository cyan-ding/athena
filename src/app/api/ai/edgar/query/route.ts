/**
 * API endpoint for querying SEC filings using RAG (vector search)
 * This endpoint:
 * 1. Takes a user question
 * 2. Optionally generates query variations for better retrieval
 * 3. Generates embeddings for each query
 * 4. Performs hybrid search (vector + keyword) with RRF fusion
 * 5. Returns the most relevant filing excerpts
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../convex/_generated/api';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { searchWithQueryExpansionRRF } from '@/lib/queryGenerator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface QueryRequest {
  ticker: string;
  question: string;
  formType?: '10-K' | '10-Q' | 'all';
  limit?: number; // Number of chunks to return (default 5)
  useQueryExpansion?: boolean; // Enable query expansion (default false)
  maxQueryVariations?: number; // Number of query variations (default 3)
}

export async function POST(req: NextRequest) {
  try {
    const body: QueryRequest = await req.json();
    const {
      ticker,
      question,
      formType,
      limit = 5,
      useQueryExpansion = false,
      maxQueryVariations = 3
    } = body;

    if (!ticker || !question) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker and question' },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase();

    console.log(`[RAG Query] Querying ${tickerUpper} for: "${question}"`);
    if (useQueryExpansion) {
      console.log(`[RAG Query] Query expansion enabled (max ${maxQueryVariations} variations)`);
    }

    let results: any[];
    let queryMetadata: any = null;

    if (useQueryExpansion) {
      // Use query expansion with RRF across multiple query variations
      const searchFunction = async (queryVariation: string) => {
        // Generate embedding for this query variation
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: queryVariation,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Perform hybrid search for this variation
        return await convex.action(api.secFilings.hybridSearchFilingChunks, {
          ticker: tickerUpper,
          query: queryVariation,
          embedding: embedding,
          formType: formType === 'all' ? undefined : formType,
          limit: limit * 2, // Get more candidates for merging
          minScore: 0.3,
        });
      };

      // Execute search with query expansion
      const expansionResult = await searchWithQueryExpansionRRF(
        question,
        searchFunction,
        {
          maxVariations: maxQueryVariations,
          rrfK: 60,
          context: {
            ticker: tickerUpper,
            formType: formType === 'all' ? undefined : formType,
            domain: 'financial',
          },
        }
      );

      results = expansionResult.results.slice(0, limit);
      queryMetadata = expansionResult.queryMetadata;

      console.log(`[RAG Query] Query expansion executed ${queryMetadata.totalQueriesExecuted} queries`);
      console.log(`[RAG Query] Merged results: ${results.length} chunks`);
    } else {
      // Standard single-query hybrid search
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
      });
      const questionEmbedding = embeddingResponse.data[0].embedding;

      results = await convex.action(api.secFilings.hybridSearchFilingChunks, {
        ticker: tickerUpper,
        query: question,
        embedding: questionEmbedding,
        formType: formType === 'all' ? undefined : formType,
        limit: limit,
        minScore: 0.3,
      });
    }

    console.log(`[RAG Query] Final results: ${results?.length || 0} chunks`);

    // DEBUG: Write raw results to file for inspection
    try {
      const debugDir = join(process.cwd(), 'debug-rag');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const debugFile = join(debugDir, `rag-query-${tickerUpper}-${timestamp}.json`);

      const debugData = {
        timestamp: new Date().toISOString(),
        ticker: tickerUpper,
        question,
        formType,
        limit,
        searchType: useQueryExpansion ? 'hybrid-with-expansion' : 'hybrid',
        useQueryExpansion,
        queryMetadata,
        resultsCount: results?.length || 0,
        results: results?.map((r: any) => ({
          section: r.section,
          formType: r.formType,
          filingDate: r.filingDate,
          hybridScore: r.hybridScore,
          vectorScore: r.vectorScore,
          keywordScore: r.keywordScore,
          rrfScore: r._rrfScore,
          queryMatches: r._queryMatches,
          textPreview: r.text?.substring(0, 200) + '...',
        })) || [],
      };

      // Create debug directory if it doesn't exist
      try {
        const { mkdirSync } = require('fs');
        mkdirSync(debugDir, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }

      writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
      console.log(`[RAG Debug] Wrote results to ${debugFile}`);
    } catch (debugError) {
      console.error('[RAG Debug] Failed to write debug file:', debugError);
    }

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: true,
        ticker: tickerUpper,
        question,
        chunks: [],
        message: 'No relevant filing content found. The filing may not be ingested yet.',
      });
    }

    console.log(`[RAG Query] Found ${results.length} relevant chunks`);

    // Step 3: Format and return results
    const chunks = results.map((result: any) => ({
      text: result.text,
      section: result.section,
      formType: result.formType,
      filingDate: result.filingDate,
      url: result.url,
      relevanceScore: result.score,
      chunkIndex: result.chunkIndex,
    }));

    return NextResponse.json({
      success: true,
      ticker: tickerUpper,
      question,
      chunks,
      metadata: {
        totalChunks: results.length,
        formTypes: [...new Set(chunks.map((c) => c.formType))],
        sections: [...new Set(chunks.map((c) => c.section))],
        useQueryExpansion,
        queryMetadata: queryMetadata ? {
          queriesExecuted: queryMetadata.totalQueriesExecuted,
          variationsUsed: queryMetadata.variationsUsed.map((v: any) => v.query),
        } : undefined,
      },
    });
  } catch (error) {
    console.error('[RAG Query] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information',
      },
      { status: 500 }
    );
  }
}
