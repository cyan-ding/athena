/**
 * Main AI chat endpoint - orchestrates Perplexity, EDGAR, and optionally browser-use
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ChatRequest {
  question: string;
  ticker?: string;
  startDate?: string;
  endDate?: string;
  useBrowserUse?: boolean; // Toggle for social scraping
}

interface Source {
  type: 'edgar' | 'perplexity' | 'social' | 'polygon';
  title: string;
  url?: string;
  content: string;
  date?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    const { question, ticker, startDate, endDate, useBrowserUse = false } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      );
    }

    console.log(`Chat request: "${question}" | Ticker: ${ticker} | Browser-use: ${useBrowserUse}`);

    const sources: Source[] = [];
    const errors: string[] = [];

    // 1. Query Perplexity (always)
    console.log('[1/3] Querying Perplexity...');
    try {
      const perplexityResponse = await fetch(`${req.nextUrl.origin}/api/ai/perplexity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, ticker, startDate, endDate }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();

        sources.push({
          type: 'perplexity',
          title: 'Perplexity Web Search',
          content: perplexityData.answer || '',
          url: 'https://perplexity.ai',
        });

        // Add search results as individual sources
        if (perplexityData.searchResults) {
          perplexityData.searchResults.forEach((result: any) => {
            sources.push({
              type: 'perplexity',
              title: result.title || 'Web Result',
              content: result.snippet || result.text || '',
              url: result.url,
              date: result.date,
            });
          });
        }
      } else {
        errors.push('Perplexity query failed');
      }
    } catch (error) {
      console.error('Perplexity error:', error);
      errors.push('Perplexity unavailable');
    }

    // 2. Query EDGAR (if ticker provided)
    if (ticker) {
      console.log('[2/3] Fetching SEC filings...');
      try {
        const edgarResponse = await fetch(`${req.nextUrl.origin}/api/ai/edgar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, startDate, endDate }),
        });

        if (edgarResponse.ok) {
          const edgarData = await edgarResponse.json();

          if (edgarData.filings && edgarData.filings.length > 0) {
            edgarData.filings.slice(0, 3).forEach((filing: any) => {
              sources.push({
                type: 'edgar',
                title: `SEC ${filing.form} - ${filing.filingDate}`,
                content: `${filing.form} filing from ${edgarData.company}`,
                url: filing.url,
                date: filing.filingDate,
              });
            });
          }
        }
      } catch (error) {
        console.error('EDGAR error:', error);
        errors.push('SEC filings unavailable');
      }
    }

    // 3. Browser-use social scraping (if enabled)
    if (useBrowserUse && ticker && startDate && endDate) {
      console.log('[3/3] Scraping social media (browser-use)...');
      try {
        const socialResponse = await fetch(`${req.nextUrl.origin}/api/ai/social`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            startDate,
            endDate,
            maxResults: 5,
          }),
        });

        if (socialResponse.ok) {
          const socialData = await socialResponse.json();

          if (socialData.data?.posts) {
            socialData.data.posts.forEach((post: any) => {
              sources.push({
                type: 'social',
                title: `${post.platform === 'reddit' ? 'Reddit' : 'Twitter'}: ${post.title}`,
                content: post.content,
                url: post.url,
                date: post.date,
              });
            });
          }
        } else {
          const errorData = await socialResponse.json();
          errors.push(errorData.error || 'Social scraping failed');
        }
      } catch (error) {
        console.error('Browser-use error:', error);
        errors.push('Social scraping unavailable (is Python service running?)');
      }
    }

    // 4. Synthesize answer with OpenAI
    console.log(`Synthesizing answer with ${sources.length} sources...`);

    if (sources.length === 0) {
      return NextResponse.json({
        answer: 'I couldn\'t gather enough information to answer your question. Please try again or rephrase your question.',
        sources: [],
        errors,
      });
    }

    // Build context from sources
    const context = sources
      .map((source, index) => {
        return `[Source ${index + 1}] ${source.title}${source.date ? ` (${source.date})` : ''}\n${source.content}\n${source.url ? `URL: ${source.url}` : ''}`;
      })
      .join('\n\n');

    const systemPrompt = `You are Athena, a financial analyst AI assistant. Answer the user's question using ONLY the provided context below.

Key instructions:
- Be concise but thorough (2-4 paragraphs max)
- Always cite sources using [Source N] format
- If the context doesn't contain enough information, say so
- Focus on facts, not speculation
- Highlight key dates and events when relevant

Context:
${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.3, // Lower temperature for more factual responses
      max_tokens: 1000,
    });

    const answer = completion.choices[0]?.message?.content || 'Unable to generate answer.';

    return NextResponse.json({
      success: true,
      answer,
      sources: sources.map((s, i) => ({
        ...s,
        id: i + 1,
      })),
      metadata: {
        usedBrowserUse: useBrowserUse,
        sourceCount: sources.length,
        errors: errors.length > 0 ? errors : undefined,
        usage: completion.usage,
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    );
  }
}
