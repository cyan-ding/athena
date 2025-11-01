/**
 * API route for scraping social media using browser-use Python service
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

interface ScrapeRequest {
  ticker: string;
  startDate: string;
  endDate: string;
  maxResults?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: ScrapeRequest = await req.json();

    const { ticker, startDate, endDate, maxResults = 5 } = body;

    if (!ticker || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, startDate, endDate' },
        { status: 400 }
      );
    }

    // Call Python browser-use service
    const response = await fetch(`${PYTHON_SERVICE_URL}/scrape/both`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker,
        start_date: startDate,
        end_date: endDate,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Browser-use service error');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Social scraping error:', error);

    // Check if Python service is running
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        {
          error: 'Browser-use service not running. Start it with: cd python-service && python main.py',
          service_url: PYTHON_SERVICE_URL
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Health check for browser-use service
export async function GET() {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`);
    const data = await response.json();

    return NextResponse.json({
      service_running: response.ok,
      service_url: PYTHON_SERVICE_URL,
      ...data,
    });
  } catch (error) {
    return NextResponse.json({
      service_running: false,
      service_url: PYTHON_SERVICE_URL,
      error: 'Could not connect to browser-use service',
    });
  }
}
