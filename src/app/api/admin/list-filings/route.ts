/**
 * Admin endpoint to list all ingested SEC filings
 * Usage: GET /api/admin/list-filings?ticker=NVDA
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');
    const formType = searchParams.get('formType');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required parameter: ticker' },
        { status: 400 }
      );
    }

    const filings = await convex.query(api.secFilings.getFilingsForTicker, {
      ticker: ticker.toUpperCase(),
      formType: formType || undefined,
    });

    return NextResponse.json({
      success: true,
      ticker: ticker.toUpperCase(),
      count: filings.length,
      filings,
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
