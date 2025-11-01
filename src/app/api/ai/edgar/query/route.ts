/**
 * API endpoint for querying SEC filings using RAG (vector search)
 * This endpoint:
 * 1. Takes a user question
 * 2. Generates an embedding for the question
 * 3. Performs vector search to find relevant chunks
 * 4. Returns the most relevant filing excerpts
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../convex/_generated/api';
import { writeFileSync } from 'fs';
import { join } from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface QueryRequest {
  ticker: string;
  question: string;
  formType?: '10-K' | '10-Q' | 'all';
  limit?: number; // Number of chunks to return (default 5)
}

export async function POST(req: NextRequest) {
  try {
    const body: QueryRequest = await req.json();
    const { ticker, question, formType, limit = 5 } = body;

    if (!ticker || !question) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker and question' },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase();

    console.log(`[RAG Query] Querying ${tickerUpper} for: "${question}"`);

    // Step 1: Generate embedding for the question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });

    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Perform HYBRID search (vector + keyword matching)
    // This combines semantic similarity with exact keyword matching for better recall
    const results = await convex.action(api.secFilings.hybridSearchFilingChunks, {
      ticker: tickerUpper,
      query: question, // For keyword search
      embedding: questionEmbedding, // For vector search
      formType: formType === 'all' ? undefined : formType,
      limit: limit,
      minScore: 0.3, // Lower threshold for vector search - be permissive
    });

    console.log(`[RAG Query] Hybrid search returned ${results?.length || 0} chunks`);

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
        searchType: 'hybrid',
        resultsCount: results?.length || 0,
        results: results?.map((r: any) => ({
          section: r.section,
          formType: r.formType,
          filingDate: r.filingDate,
          hybridScore: r.hybridScore,
          vectorScore: r.vectorScore,
          keywordScore: r.keywordScore,
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
