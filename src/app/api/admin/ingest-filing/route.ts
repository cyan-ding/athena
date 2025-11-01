/**
 * Admin endpoint to trigger SEC filing ingestion
 * Usage: POST /api/admin/ingest-filing
 * Body: { ticker: "NVDA", formType: "10-K" }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, formType = '10-K', accessionNumber } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker' },
        { status: 400 }
      );
    }

    // Forward to ingest endpoint
    const ingestResponse = await fetch(`${req.nextUrl.origin}/api/ai/edgar/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, formType, accessionNumber }),
    });

    const result = await ingestResponse.json();

    if (!ingestResponse.ok) {
      return NextResponse.json(result, { status: ingestResponse.status });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${formType} for ${ticker}`,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
