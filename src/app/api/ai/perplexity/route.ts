/**
 * API route for Perplexity AI queries
 * Uses OpenAI SDK with Perplexity base URL
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
});

interface PerplexityRequest {
  question: string;
  ticker?: string;
  startDate?: string;
  endDate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: PerplexityRequest = await req.json();

    const { question, ticker, startDate, endDate } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      );
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'PERPLEXITY_API_KEY not configured in environment variables' },
        { status: 500 }
      );
    }

    // Build context-aware query
    let fullQuery = question;
    if (ticker) {
      fullQuery += ` for ${ticker}`;
    }
    if (startDate && endDate) {
      fullQuery += ` between ${startDate} and ${endDate}`;
    }

    // Query Perplexity with sonar-pro model
    const response = await perplexity.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst assistant. Provide factual, well-sourced answers about stocks, markets, and companies. Always cite your sources.',
        },
        {
          role: 'user',
          content: fullQuery,
        },
      ],
    });

    const answer = response.choices[0]?.message?.content || '';

    // Extract citations and search results from response
    // Note: Perplexity includes these in the response metadata
    const citations = (response as any).citations || [];
    const searchResults = (response as any).search_results || [];

    return NextResponse.json({
      success: true,
      answer,
      citations,
      searchResults,
      model: 'sonar-pro',
      usage: response.usage,
    });

  } catch (error) {
    console.error('Perplexity API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check that PERPLEXITY_API_KEY is valid'
      },
      { status: 500 }
    );
  }
}
