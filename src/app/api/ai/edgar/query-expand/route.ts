import { NextRequest, NextResponse } from 'next/server';
import { generateQueryVariations } from '@/lib/queryGenerator';

/**
 * POST /api/ai/edgar/query-expand
 *
 * Test endpoint for query generation
 * Generates multiple query variations to improve RAG retrieval
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, ticker, formType } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`[Query Expansion] Generating variations for: "${query}"`);

    // Generate query variations
    const result = await generateQueryVariations(query, {
      ticker,
      formType,
      domain: 'financial',
    });

    console.log(`[Query Expansion] Generated ${result.variations.length} variations`);

    return NextResponse.json({
      success: true,
      original: result.original,
      variations: result.variations,
      estimatedRelevance: result.estimatedRelevance,
      metadata: {
        ticker,
        formType,
        variationCount: result.variations.length,
      },
    });
  } catch (error) {
    console.error('[Query Expansion Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate query variations',
      },
      { status: 500 }
    );
  }
}
