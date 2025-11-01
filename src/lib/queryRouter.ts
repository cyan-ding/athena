/**
 * Query Router - Intelligently routes queries to appropriate data sources using LLM classification
 *
 * Determines whether a query needs:
 * - User memory only (personal preferences, trading history)
 * - External data only (SEC filings, web search, social media)
 * - Both (personalized recommendations with external context)
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export type QueryIntent =
  | 'user_memory_only'    // Personal queries about user's own behavior/preferences
  | 'external_data_only'  // Market research queries
  | 'hybrid';             // Personalized recommendations

export interface RoutingDecision {
  intent: QueryIntent;
  requiresMemory: boolean;
  requiresPerplexity: boolean;
  requiresEdgar: boolean;
  requiresSocial: boolean;
  confidence: number;
  reasoning: string;
}


/**
 * Route a user query to appropriate data sources using LLM classification
 */
export async function routeQuery(question: string, ticker?: string): Promise<RoutingDecision> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, using fallback routing');
    return fallbackRouting(question, ticker);
  }

  try {
    const systemPrompt = `You are a query classification system for a trading assistant. Classify the user's query into one of three categories:

1. **user_memory_only**: The query is asking about the user's own trading history, preferences, or past behavior.
   Examples: "What stocks have I bought?", "Show me my portfolio", "Did I ever buy AAPL?", "What do I usually invest in?"

2. **external_data_only**: The query is asking for objective market data, company information, or general research without needing personalization.
   Examples: "What is AAPL's market cap?", "Tell me about Tesla's latest 10-K", "Latest news about NVDA", "What are Microsoft's earnings?"

3. **hybrid**: The query requires both personal context AND external market data, typically for personalized recommendations.
   Examples: "Should I buy AAPL?", "Is Tesla a good fit for my portfolio?", "What do you think about NVDA for me?"

Respond ONLY with valid JSON in this exact format:
{
  "intent": "user_memory_only" | "external_data_only" | "hybrid",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification"
}`;

    const userPrompt = ticker
      ? `Classify this query: "${question}" (ticker: ${ticker})`
      : `Classify this query: "${question}"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap for classification
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0, // Deterministic classification
      max_tokens: 150,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error('Empty response from LLM');
    }

    // Parse JSON response
    const classification = JSON.parse(response);
    const intent: QueryIntent = classification.intent;

    // Determine which sources to use based on intent
    const requiresMemory = intent === 'user_memory_only' || intent === 'hybrid';
    const requiresPerplexity = intent === 'external_data_only' || intent === 'hybrid';
    const requiresEdgar = (intent === 'external_data_only' || intent === 'hybrid') && !!ticker;
    const requiresSocial = false; // Only enable if user explicitly requests or useBrowserUse flag is set

    return {
      intent,
      requiresMemory,
      requiresPerplexity,
      requiresEdgar,
      requiresSocial,
      confidence: classification.confidence || 0.9,
      reasoning: classification.reasoning || 'LLM classification',
    };
  } catch (error) {
    console.error('LLM routing failed, using fallback:', error);
    return fallbackRouting(question, ticker);
  }
}

/**
 * Fallback routing logic using simple pattern matching
 */
function fallbackRouting(question: string, ticker?: string): RoutingDecision {
  const lowerQuestion = question.toLowerCase();

  // Simple heuristics
  const hasPersonalKeywords = /\b(my|i|me|mine|i've|i have)\b/i.test(question);
  const hasActionKeywords = /\b(should|recommend|buy|sell|good fit|think about)\b/i.test(question);
  const hasDataKeywords = /\b(market cap|earnings|revenue|10-k|10-q|filing|news|price)\b/i.test(question);

  let intent: QueryIntent;
  let reasoning: string;

  if (hasPersonalKeywords && !hasActionKeywords && !hasDataKeywords) {
    intent = 'user_memory_only';
    reasoning = 'Query contains personal keywords without action/data requests';
  } else if (hasDataKeywords && !hasPersonalKeywords) {
    intent = 'external_data_only';
    reasoning = 'Query asks for market data without personalization';
  } else {
    intent = 'hybrid';
    reasoning = 'Query requires both personal and market context';
  }

  const requiresMemory = intent === 'user_memory_only' || intent === 'hybrid';
  const requiresPerplexity = intent === 'external_data_only' || intent === 'hybrid';
  const requiresEdgar = (intent === 'external_data_only' || intent === 'hybrid') && !!ticker;

  return {
    intent,
    requiresMemory,
    requiresPerplexity,
    requiresEdgar,
    requiresSocial: false,
    confidence: 0.6,
    reasoning: `${reasoning} (fallback routing)`,
  };
}

/**
 * Examples for testing:
 *
 * User Memory Only:
 * - "What stocks have I bought?"
 * - "Show me my trading history"
 * - "What do I usually invest in?"
 * - "Did I ever buy AAPL?"
 *
 * External Data Only:
 * - "What is AAPL's market cap?"
 * - "Tell me about Tesla's latest 10-K"
 * - "What is the market outlook for tech stocks?"
 * - "Latest news about NVDA"
 *
 * Hybrid:
 * - "Should I buy more AAPL?" (needs both user's AAPL history + current market data)
 * - "Is TSLA a good fit for my portfolio?" (needs user preferences + TSLA analysis)
 * - "What do you think about NVDA for me?" (personalized recommendation)
 */
