/**
 * Main AI chat endpoint - orchestrates Perplexity, EDGAR, and optionally browser-use
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTradingContext, logUserQuestion, logAIRecommendation } from '@/lib/hyperspell';
import { routeQuery, type RoutingDecision } from '@/lib/queryRouter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ChatRequest {
  question: string;
  ticker?: string;
  startDate?: string;
  endDate?: string;
  useBrowserUse?: boolean; // Toggle for social scraping
  userId?: string; // For memory tracking
}

interface Source {
  type: 'edgar' | 'perplexity' | 'social' | 'polygon';
  title: string;
  url?: string;
  content: string;
  date?: string;
}

/**
 * Determines if query expansion should be enabled based on query characteristics
 * Currently configured to ALWAYS enable query expansion for all queries
 */
function shouldEnableQueryExpansion(_question: string): boolean {
  // Always enable query expansion for maximum retrieval coverage
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    const { question, ticker, startDate, endDate, useBrowserUse = false, userId = 'demo-user' } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      );
    }

    console.log(`Chat request: "${question}" | Ticker: ${ticker} | Browser-use: ${useBrowserUse} | User: ${userId}`);

    // Route the query to determine which data sources to use (async LLM-based classification)
    const routing: RoutingDecision = await routeQuery(question, ticker);
    console.log(`[Router] Intent: ${routing.intent} (${routing.confidence * 100}% confidence)`);
    console.log(`[Router] Reasoning: ${routing.reasoning}`);
    console.log(`[Router] Sources: Memory=${routing.requiresMemory}, Perplexity=${routing.requiresPerplexity}, EDGAR=${routing.requiresEdgar}, Social=${routing.requiresSocial}`);

    // Log the question to Hyperspell memory
    await logUserQuestion({
      userId,
      ticker,
      question,
    });

    const sources: Source[] = [];
    const errors: string[] = [];
    let edgarQueryExpansionUsed = false;
    let edgarQueryMetadata: any = null;

    // Create a ReadableStream for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (stage: string, progress: number, total: number) => {
          const data = JSON.stringify({ type: 'progress', stage, progress, total });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const sendComplete = (result: any) => {
          const data = JSON.stringify({ type: 'complete', ...result });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        };

        try {
          // Calculate total steps based on routing decision
          let totalSteps = 0;
          if (routing.requiresMemory) totalSteps++;
          if (routing.requiresPerplexity) totalSteps++;
          if (routing.requiresEdgar) totalSteps++;
          if (useBrowserUse || routing.requiresSocial) totalSteps++;
          totalSteps++; // Always include synthesis step

          let currentStep = 0;

          // Get user's trading context from Hyperspell memory (if needed)
          let tradingMemoryContext = '';
          if (routing.requiresMemory) {
            currentStep++;
            try {
              sendProgress('Fetching trading memory...', currentStep, totalSteps);
              console.log(`[${currentStep}/${totalSteps}] Fetching user trading memory from Hyperspell...`);
              tradingMemoryContext = await getTradingContext({
                userId,
                ticker,
                query: `${question} ${ticker || ''}`,
              });
              console.log('[Memory] Context retrieved:', tradingMemoryContext.substring(0, 200) + '...');
            } catch (error) {
              console.error('Failed to fetch trading memory:', error);
            }
          } else {
            console.log('[Router] Skipping memory fetch - not required for this query type');
          }

          // 1. Query Perplexity (if needed)
          if (routing.requiresPerplexity) {
            currentStep++;
            sendProgress('Querying Perplexity...', currentStep, totalSteps);
            console.log(`[${currentStep}/${totalSteps}] Querying Perplexity...`);
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
          } else {
            console.log('[Router] Skipping Perplexity - not required for this query type');
          }

          // 2. Query EDGAR with RAG (if needed)
          if (routing.requiresEdgar) {
            currentStep++;
            sendProgress('Querying SEC filings...', currentStep, totalSteps);
            console.log(`[${currentStep}/${totalSteps}] Querying SEC filings with RAG...`);
            try {
              // Determine if query expansion should be enabled
              // Enable for vague/short queries that would benefit from multiple search angles
              const shouldUseQueryExpansion = shouldEnableQueryExpansion(question);

              if (shouldUseQueryExpansion) {
                console.log(`[EDGAR] Enabling query expansion for vague query: "${question}"`);
              }

              // Use RAG to get relevant filing excerpts
              const ragResponse = await fetch(`${req.nextUrl.origin}/api/ai/edgar/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ticker,
                  question,
                  formType: '10-K', // Focus on annual reports for now
                  limit: 5,
                  useQueryExpansion: shouldUseQueryExpansion,
                  maxQueryVariations: 3,
                }),
              });

              if (ragResponse.ok) {
                const ragData = await ragResponse.json();

                // Store query expansion metadata
                if (ragData.metadata?.useQueryExpansion) {
                  edgarQueryExpansionUsed = true;
                  edgarQueryMetadata = ragData.metadata.queryMetadata;
                  console.log(`[EDGAR] Query expansion used: ${edgarQueryMetadata?.queriesExecuted} queries executed`);
                }

                if (ragData.chunks && ragData.chunks.length > 0) {
                  // Add each relevant chunk as a source
                  ragData.chunks.forEach((chunk: any, index: number) => {
                    sources.push({
                      type: 'edgar',
                      title: `${chunk.formType} ${chunk.section} (${chunk.filingDate})`,
                      content: chunk.text, // Actual filing content!
                      url: chunk.url,
                      date: chunk.filingDate,
                    });
                  });
                } else {
                  // Fallback: If no RAG results, fetch filing metadata
                  console.log('[3/' + totalSteps + '] No RAG results, falling back to metadata...');
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
                          content: `${filing.form} filing from ${edgarData.company} (not yet ingested for RAG)`,
                          url: filing.url,
                          date: filing.filingDate,
                        });
                      });
                    }
                  }
                }
              }
            } catch (error) {
              console.error('EDGAR RAG error:', error);
              errors.push('SEC filings unavailable');
            }
          } else {
            console.log('[Router] Skipping EDGAR - not required for this query type');
          }

          // 3. Browser-use social scraping (if enabled)
          if ((useBrowserUse || routing.requiresSocial) && ticker && startDate && endDate) {
            currentStep++;
            sendProgress('Scraping social media...', currentStep, totalSteps);
            console.log(`[${currentStep}/${totalSteps}] Scraping social media (browser-use)...`);
            try {
              const socialResponse = await fetch(`${req.nextUrl.origin}/api/ai/social`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ticker,
                  startDate,
                  endDate,
                  maxResults: 1,
                }),
              });

              if (socialResponse.ok) {
                const socialData = await socialResponse.json();
                console.log('[SOCIAL] Response data:', JSON.stringify(socialData, null, 2));

                if (socialData.data?.posts) {
                  console.log(`[SOCIAL] Adding ${socialData.data.posts.length} posts to sources`);
                  socialData.data.posts.forEach((post: any) => {
                    const source = {
                      type: 'social' as const,
                      title: `${post.platform === 'reddit' ? 'Reddit' : 'Twitter'}: ${post.title}`,
                      content: post.content,
                      url: post.url,
                      date: post.date,
                    };
                    console.log('[SOCIAL] Adding source:', source.title);
                    sources.push(source);
                  });
                } else {
                  console.log('[SOCIAL] No posts found in response');
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
          currentStep++;
          sendProgress('Synthesizing answer...', currentStep, totalSteps);
          console.log(`[Chat] Synthesizing answer with ${sources.length} sources...`);
          console.log(`[Chat] Source types:`, sources.map(s => s.type).join(', '));
          console.log(`[Chat] Query intent: ${routing.intent}`);

          // Log social sources specifically
          const socialSources = sources.filter(s => s.type === 'social');
          console.log(`[Chat] Social sources: ${socialSources.length}`);
          socialSources.forEach((s, i) => {
            console.log(`[Chat] Social ${i+1}: ${s.title} - ${s.content.substring(0, 100)}...`);
          });

          // Handle user memory-only queries differently
          if (routing.intent === 'user_memory_only') {
            if (!tradingMemoryContext || tradingMemoryContext === 'No relevant trading history found.') {
              sendComplete({
                success: true,
                answer: 'I don\'t have any trading history for you yet. Once you start making trades, I\'ll remember them and can help you track your patterns and preferences.',
                sources: [],
                metadata: {
                  intent: routing.intent,
                  hasMemory: false,
                },
              });
              return;
            }

            // For memory-only queries, answer directly from memory without external sources
            const memoryAnswer = await openai.chat.completions.create({
              model: 'gpt-4-turbo',
              messages: [
                {
                  role: 'system',
                  content: `You are Athena, a personalized AI trading assistant. Answer the user's question using ONLY their trading history below. Do not make up or infer information not present in the history.

USER'S TRADING HISTORY:
${tradingMemoryContext}

Instructions:
- Be concise and direct
- Only reference information that exists in the trading history
- If the history doesn't contain the answer, say so clearly
- Use bullet points for lists
- Include specific details (tickers, quantities, prices) when available`
                },
                { role: 'user', content: question },
              ],
              max_tokens: 500,
            });

            const answer = memoryAnswer.choices[0]?.message?.content || 'Unable to retrieve trading history.';

            sendComplete({
              success: true,
              answer,
              sources: [],
              metadata: {
                intent: routing.intent,
                hasMemory: true,
                usage: memoryAnswer.usage,
              },
            });
            return;
          }

          if (sources.length === 0 && !tradingMemoryContext) {
            sendComplete({
              success: false,
              answer: 'I couldn\'t gather enough information to answer your question. Please try again or rephrase your question.',
              sources: [],
              errors,
            });
            return;
          }

          // Build context from sources
          const context = sources
            .map((source, index) => {
              return `[Source ${index + 1}] ${source.title}${source.date ? ` (${source.date})` : ''}\n${source.content}\n${source.url ? `URL: ${source.url}` : ''}`;
            })
            .join('\n\n');

          // Customize system prompt based on query intent
          let systemPrompt: string;

          if (routing.intent === 'hybrid') {
            systemPrompt = `You are Athena, a personalized AI trading assistant with memory. Answer the user's question using both their trading history and current market context.

Key instructions:
- PERSONALIZATION: Reference the user's trading history and past decisions when relevant
- ORGANIZATION: Use clear section headers (e.g., "## Your History with ${ticker || 'this stock'}", "## Current Market Context", "## Recommendation")
- SOURCES: **CRITICAL** - You MUST cite and reference ALL provided sources using [Source N] format. This includes:
  * SEC filings (10-K, 10-Q, etc.)
  * Web research and news articles
  * Social media posts (Reddit threads, X/Twitter posts)
  * Any other data sources provided
- COMPREHENSIVE: Reference information from ALL source types that are present in the context. If Reddit posts exist, cite them. If X posts exist, cite them. Do not ignore any source type.
- BALANCE: Combine personal insights with objective market data from all available sources
- CONCISENESS: 3-5 paragraphs total
- If the user has traded this stock before, compare their past rationale with current conditions

${tradingMemoryContext ? `USER'S TRADING HISTORY:\n${tradingMemoryContext}\n\n` : ''}MARKET CONTEXT:
${context}`;
          } else {
            // External data only
            systemPrompt = `You are Athena, a financial research assistant. Answer the user's question using the provided market context.

Key instructions:
- ORGANIZATION: Group information by source type. Create sections for each type present (e.g., "## SEC Filings", "## Web Research", "## Social Media Sentiment")
- SOURCES: **CRITICAL** - You MUST cite and reference ALL provided sources using [Source N] format. This includes:
  * SEC filings (10-K, 10-Q, 8-K, etc.) - Always cite these when discussing financials or company disclosures
  * Web research and news articles - Cite when discussing market conditions or news
  * Social media posts (Reddit, X/Twitter) - **ALWAYS cite and reference these when present**. Social sentiment is valuable context.
  * Any other data sources provided
- COMPREHENSIVE: You must acknowledge and incorporate information from EVERY source type provided. If Reddit posts are included, explicitly reference them (e.g., "According to Reddit discussions [Source 5]..."). If X/Twitter posts are included, cite them (e.g., "Social media sentiment on X [Source 7] suggests..."). Do NOT skip or ignore any source type.
- OBJECTIVITY: Focus on facts, not speculation or recommendations
- CONCISENESS: 3-5 paragraphs total, but ensure all source types are covered
- DATES: Highlight key dates and events when relevant
- TRANSPARENCY: At the end, briefly note which source types were used in your analysis (e.g., "Analysis based on: SEC filings, web research, and Reddit discussions")

MARKET CONTEXT:
${context}`;
          }

          console.log(`[Chat] Synthesizing answer with model: gpt-4-turbo`);
          const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: question },
            ],
            max_tokens: 800,
          });

          console.log(`[Chat] Completion response:`, completion);
          const answer = completion.choices[0]?.message?.content || 'Unable to generate answer.';
          console.log(`[Chat] Generated answer:`, answer);

          // Log AI recommendation to Hyperspell memory (async, don't wait)
          if (ticker) {
            logAIRecommendation({
              userId,
              ticker,
              question,
              recommendation: answer.substring(0, 200), // Store summary
              reasoning: `Based on ${sources.length} sources including ${sources.map(s => s.type).join(', ')}`,
            }).catch(err => console.error('Failed to log AI recommendation:', err));
          }

          sendComplete({
            success: true,
            answer,
            sources: sources.map((s, i) => ({
              ...s,
              id: i + 1,
            })),
            metadata: {
              intent: routing.intent,
              routingConfidence: routing.confidence,
              usedBrowserUse: useBrowserUse,
              sourceCount: sources.length,
              errors: errors.length > 0 ? errors : undefined,
              usage: completion.usage,
              hasMemory: tradingMemoryContext.length > 0,
              queryExpansion: edgarQueryExpansionUsed ? {
                enabled: true,
                queriesExecuted: edgarQueryMetadata?.queriesExecuted,
                variationsUsed: edgarQueryMetadata?.variationsUsed,
              } : undefined,
            },
          });
        } catch (error) {
          console.error('Stream error:', error);
          sendComplete({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            sources: [],
          });
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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
