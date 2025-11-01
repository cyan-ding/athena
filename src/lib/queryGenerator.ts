import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface QueryVariation {
  query: string;
  strategy: 'specific' | 'broad' | 'alternative_phrasing' | 'decomposed' | 'keyword_focused';
  reasoning: string;
}

export interface QueryGenerationResult {
  original: string;
  variations: QueryVariation[];
  estimatedRelevance: number;
}

/**
 * Generates multiple query variations to improve RAG retrieval success
 * Uses LLM to create semantically diverse queries that are likely to match documents
 */
export async function generateQueryVariations(
  originalQuery: string,
  context?: {
    ticker?: string;
    formType?: string;
    domain?: 'financial' | 'general';
  }
): Promise<QueryGenerationResult> {
  const domain = context?.domain || 'financial';
  const ticker = context?.ticker || 'the company';
  const formType = context?.formType || 'SEC filings';

  const systemPrompt = `You are a query expansion expert specializing in ${domain} document retrieval.
Your task is to generate multiple query variations that will improve retrieval from a RAG system searching ${formType}.

Generate 5 diverse query variations using these strategies:
1. SPECIFIC: Add domain-specific terminology and precise phrasing
2. BROAD: Rephrase to capture general concepts that might appear in documents
3. ALTERNATIVE_PHRASING: Use synonyms and different sentence structures
4. DECOMPOSED: Break complex queries into simpler sub-questions
5. KEYWORD_FOCUSED: Extract key terms that documents likely contain

Each variation should:
- Be semantically related to the original query
- Use jargon likely to appear in actual SEC documents
- Expand on different aspects or framings of the question
- Be clear and specific enough for vector search

Return ONLY a valid JSON object (no markdown, no explanations) in this exact format:
{
  "variations": [
    {
      "query": "specific query text here",
      "strategy": "specific",
      "reasoning": "why this variation will help"
    }
  ],
  "estimatedRelevance": 0.85
}`;

  const userPrompt = `Original query: "${originalQuery}"
${context?.ticker ? `Context: Searching for ${context.ticker} in ${formType}` : ''}

Generate 5 query variations following the strategies above. Focus on queries that will match actual document text in ${domain} documents.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(responseText);

    return {
      original: originalQuery,
      variations: parsed.variations,
      estimatedRelevance: parsed.estimatedRelevance || 0.7,
    };
  } catch (error) {
    console.error('Error generating query variations:', error);

    // Fallback: return basic variations using simple transformations
    return {
      original: originalQuery,
      variations: [
        {
          query: originalQuery,
          strategy: 'specific',
          reasoning: 'Original query (fallback mode)'
        },
        {
          query: `What information is available about ${originalQuery.toLowerCase()}?`,
          strategy: 'broad',
          reasoning: 'Broadened question format (fallback mode)'
        },
        {
          query: extractKeywords(originalQuery).join(' '),
          strategy: 'keyword_focused',
          reasoning: 'Extracted keywords (fallback mode)'
        }
      ],
      estimatedRelevance: 0.5,
    };
  }
}

/**
 * Simple keyword extraction fallback
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
}

/**
 * Generates query variations and executes them in parallel against a search function
 * Merges results using a ranking strategy
 */
export async function searchWithQueryExpansion<T extends { _id: string; [key: string]: any }>(
  originalQuery: string,
  searchFunction: (query: string) => Promise<T[]>,
  options: {
    maxVariations?: number;
    deduplicateResults?: boolean;
    context?: {
      ticker?: string;
      formType?: string;
      domain?: 'financial' | 'general';
    };
  } = {}
): Promise<{
  results: T[];
  queryMetadata: {
    original: string;
    variationsUsed: QueryVariation[];
    totalQueriesExecuted: number;
  };
}> {
  const { maxVariations = 3, deduplicateResults = true, context } = options;

  // Generate query variations
  const queryGeneration = await generateQueryVariations(originalQuery, context);

  // Select top N variations (including original)
  const queriesToExecute = [
    { query: originalQuery, strategy: 'original' as const, reasoning: 'Original user query' },
    ...queryGeneration.variations.slice(0, maxVariations - 1)
  ];

  // Execute all queries in parallel
  const searchPromises = queriesToExecute.map(async (variation, index) => {
    try {
      const results = await searchFunction(variation.query);
      return results.map(result => ({
        ...result,
        _queryIndex: index,
        _queryStrategy: variation.strategy,
        _originalQuery: variation.query,
      }));
    } catch (error) {
      console.error(`Error executing query variation "${variation.query}":`, error);
      return [];
    }
  });

  const allResultArrays = await Promise.all(searchPromises);
  const allResults = allResultArrays.flat();

  // Deduplicate by _id if enabled
  let finalResults: T[];
  if (deduplicateResults) {
    const seen = new Set<string>();
    finalResults = allResults.filter(result => {
      if (seen.has(result._id)) {
        return false;
      }
      seen.add(result._id);
      return true;
    });
  } else {
    finalResults = allResults;
  }

  return {
    results: finalResults,
    queryMetadata: {
      original: originalQuery,
      variationsUsed: queriesToExecute as QueryVariation[],
      totalQueriesExecuted: queriesToExecute.length,
    },
  };
}

/**
 * Enhanced version that merges results using Reciprocal Rank Fusion (RRF)
 * across multiple query variations
 */
export async function searchWithQueryExpansionRRF<T extends { _id: string; [key: string]: any }>(
  originalQuery: string,
  searchFunction: (query: string) => Promise<T[]>,
  options: {
    maxVariations?: number;
    rrfK?: number; // RRF constant (default 60)
    context?: {
      ticker?: string;
      formType?: string;
      domain?: 'financial' | 'general';
    };
  } = {}
): Promise<{
  results: (T & { _rrfScore: number; _queryMatches: string[] })[];
  queryMetadata: {
    original: string;
    variationsUsed: QueryVariation[];
    totalQueriesExecuted: number;
  };
}> {
  const { maxVariations = 3, rrfK = 60, context } = options;

  // Generate query variations
  const queryGeneration = await generateQueryVariations(originalQuery, context);

  // Select top N variations (including original)
  const queriesToExecute = [
    { query: originalQuery, strategy: 'original' as const, reasoning: 'Original user query' },
    ...queryGeneration.variations.slice(0, maxVariations - 1)
  ];

  // Execute all queries in parallel
  const searchPromises = queriesToExecute.map(async (variation) => {
    try {
      return await searchFunction(variation.query);
    } catch (error) {
      console.error(`Error executing query variation "${variation.query}":`, error);
      return [];
    }
  });

  const allResultArrays = await Promise.all(searchPromises);

  // Build RRF scores
  const scoreMap = new Map<string, { result: T; rrfScore: number; queries: string[] }>();

  allResultArrays.forEach((results, queryIndex) => {
    results.forEach((result, rank) => {
      const id = result._id;
      const existing = scoreMap.get(id);
      const rrfContribution = 1 / (rrfK + rank + 1);

      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.queries.push(queriesToExecute[queryIndex].query);
      } else {
        scoreMap.set(id, {
          result,
          rrfScore: rrfContribution,
          queries: [queriesToExecute[queryIndex].query],
        });
      }
    });
  });

  // Convert to array and sort by RRF score
  const rankedResults = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ result, rrfScore, queries }) => ({
      ...result,
      _rrfScore: rrfScore,
      _queryMatches: queries,
    }));

  return {
    results: rankedResults,
    queryMetadata: {
      original: originalQuery,
      variationsUsed: queriesToExecute as QueryVariation[],
      totalQueriesExecuted: queriesToExecute.length,
    },
  };
}
