/**
 * API route for SEC EDGAR filings
 * Free, no authentication required
 */

import { NextRequest, NextResponse } from 'next/server';

const EDGAR_BASE = 'https://data.sec.gov';

// Company ticker to CIK mapping (expand as needed)
const TICKER_TO_CIK: Record<string, string> = {
  'AAPL': '0000320193',
  'NVDA': '0001045810',
  'TSLA': '0001318605',
  'MSFT': '0000789019',
  'GOOGL': '0001652044',
  'GOOG': '0001652044',
  'META': '0001326801',
  'AMZN': '0001018724',
};

interface EdgarRequest {
  ticker: string;
  formType?: '10-K' | '8-K' | '10-Q' | 'all';
  startDate?: string;
  endDate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: EdgarRequest = await req.json();

    const { ticker, formType = 'all', startDate, endDate } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker' },
        { status: 400 }
      );
    }

    // Get CIK for ticker
    const cik = TICKER_TO_CIK[ticker.toUpperCase()];
    if (!cik) {
      return NextResponse.json(
        {
          error: `CIK mapping not found for ticker: ${ticker}`,
          available_tickers: Object.keys(TICKER_TO_CIK)
        },
        { status: 404 }
      );
    }

    // Fetch company submissions
    // SEC requires User-Agent header with contact info
    const response = await fetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`, {
      headers: {
        'User-Agent': 'Athena AI athena@example.com',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`EDGAR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract recent filings
    const filings = data.filings?.recent || {};
    const accessionNumber = filings.accessionNumber || [];
    const filingDate = filings.filingDate || [];
    const reportDate = filings.reportDate || [];
    const form = filings.form || [];
    const primaryDocument = filings.primaryDocument || [];

    // Build filings array
    const allFilings = accessionNumber.map((accession: string, index: number) => ({
      accessionNumber: accession,
      filingDate: filingDate[index],
      reportDate: reportDate[index],
      form: form[index],
      primaryDocument: primaryDocument[index],
      url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accession.replace(/-/g, '')}/${primaryDocument[index]}`,
    }));

    // Filter by form type if specified
    let filtered = allFilings;
    if (formType !== 'all') {
      filtered = filtered.filter((f: any) => f.form === formType);
    }

    // Filter by date range if specified
    if (startDate) {
      filtered = filtered.filter((f: any) => f.filingDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((f: any) => f.filingDate <= endDate);
    }

    return NextResponse.json({
      success: true,
      ticker: ticker.toUpperCase(),
      cik,
      company: data.name,
      filings: filtered.slice(0, 10), // Return max 10 most recent
      totalCount: filtered.length,
    });

  } catch (error) {
    console.error('EDGAR API error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Add more CIK mappings endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({
      available_tickers: Object.keys(TICKER_TO_CIK),
      message: 'Add ticker parameter to check if mapping exists',
    });
  }

  const cik = TICKER_TO_CIK[ticker.toUpperCase()];

  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    cik: cik || null,
    exists: !!cik,
  });
}
