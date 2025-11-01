// Hyperspell Memory Layer for AI Agents
// Provides context and long-term memory for personalized trading assistance

import Hyperspell from 'hyperspell';

const hyperspell = new Hyperspell({
  apiKey: process.env.HYPERSPELL_API_KEY || '',
});

export interface HyperspellMemory {
  id: string;
  userId: string;
  type: string;
  content: any;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface HyperspellQueryResult {
  memories: HyperspellMemory[];
  relevance: number;
}

// Add a memory entry
export async function addMemory(params: {
  userId: string;
  type: string;
  content: any;
  metadata?: Record<string, any>;
}): Promise<HyperspellMemory> {
  if (!process.env.HYPERSPELL_API_KEY) {
    console.warn('Hyperspell API key not configured, skipping memory storage');
    return {
      id: `local-${Date.now()}`,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata,
      timestamp: Date.now(),
    };
  }

  try {
    // Convert content to string format for Hyperspell
    const contentStr = typeof params.content === 'string'
      ? params.content
      : JSON.stringify(params.content);

    // Add type prefix TWICE: once for semantic search, once for parsing
    // Format: TYPE:type_value [type_value] actual content
    // This ensures the type survives Hyperspell's summarization
    const enrichedText = `TYPE:${params.type} [${params.type}] ${contentStr}`;

    const result = await hyperspell.memories.add({
      text: enrichedText,
      collection: params.userId, // Use userId as collection to isolate user memories
    });

    return {
      id: result.resource_id,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn('Failed to add memory to Hyperspell:', error);
    // Return local memory as fallback
    return {
      id: `local-${Date.now()}`,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata,
      timestamp: Date.now(),
    };
  }
}

// Query memories with semantic search
export async function queryMemories(params: {
  userId: string;
  query: string;
  type?: string;
  limit?: number;
}): Promise<HyperspellMemory[]> {
  if (!process.env.HYPERSPELL_API_KEY) {
    console.warn('Hyperspell API key not configured, returning empty memories');
    return [];
  }

  try {
    // Build query string, optionally filtering by type
    const searchQuery = params.type
      ? `${params.query} TYPE:${params.type}`
      : params.query;

    const response = await hyperspell.memories.search({
      query: searchQuery,
      sources: ['vault'],
      options: {
        max_results: params.limit || 10,
        vault: {
          collection: params.userId,
        },
      } as any,
    });

    // Check for errors
    if (response.errors && response.errors.length > 0) {
      console.warn('[Hyperspell] Search errors:', response.errors);
    }

    // Parse documents back into HyperspellMemory format
    return response.documents.map((doc: any, index: number) => {
      // Hyperspell returns highlights with text, or summary as fallback
      const fullText = doc.highlights?.[0]?.text || doc.summary || doc.text || '';

      // Extract type from the original stored format
      let type = params.type || 'unknown';
      let content = fullText;

      // Try TYPE:xxx pattern
      const typeColonMatch = fullText.match(/TYPE:(\w+)/);
      if (typeColonMatch) {
        type = typeColonMatch[1];
        // Remove TYPE:xxx and [xxx] prefixes from content
        content = fullText.replace(/TYPE:\w+\s*/, '').replace(/^\[[^\]]+\]\s*/, '');
      } else {
        // Fallback to [type] pattern
        const typeBracketMatch = fullText.match(/^\[([^\]]+)\]/);
        if (typeBracketMatch) {
          type = typeBracketMatch[1];
          content = fullText.replace(/^\[[^\]]+\]\s*/, '');
        }
      }

      return {
        id: doc.resource_id || `result-${index}`,
        userId: params.userId,
        type,
        content,
        metadata: doc.metadata || {},
        timestamp: Date.now(),
      };
    });
  } catch (error) {
    console.error('Failed to query Hyperspell memories:', error);
    return [];
  }
}

// Get recent memories for a user
export async function getRecentMemories(params: {
  userId: string;
  type?: string;
  limit?: number;
}): Promise<HyperspellMemory[]> {
  if (!process.env.HYPERSPELL_API_KEY) {
    console.warn('Hyperspell API key not configured, returning empty memories');
    return [];
  }

  try {
    // Use a broad query to get recent memories from the user's collection
    const searchQuery = params.type ? `[${params.type}]` : '*';

    const response = await hyperspell.memories.search({
      query: searchQuery,
      sources: ['vault'],
      options: {
        max_results: params.limit || 20,
        vault: {
          collection: params.userId,
        },
      } as any, // Type assertion for dynamic source options
    });

    // Parse documents back into HyperspellMemory format
    return response.documents.map((doc: any, index: number) => {
      // Hyperspell returns highlights with text, not doc.text directly
      const fullText = doc.highlights?.[0]?.text || doc.summary || '';

      // Extract type - try TYPE: prefix first, then [type] format
      let type = 'unknown';
      let content = fullText;

      // Try TYPE:xxx pattern
      const typeColonMatch = fullText.match(/TYPE:(\w+)/);
      if (typeColonMatch) {
        type = typeColonMatch[1];
        // Remove TYPE:xxx and [xxx] prefixes from content
        content = fullText.replace(/TYPE:\w+\s*/, '').replace(/^\[[^\]]+\]\s*/, '');
      } else {
        // Fallback to [type] pattern
        const typeBracketMatch = fullText.match(/^\[([^\]]+)\]/);
        if (typeBracketMatch) {
          type = typeBracketMatch[1];
          content = fullText.replace(/^\[[^\]]+\]\s*/, '');
        }
      }

      return {
        id: doc.resource_id || `result-${index}`,
        userId: params.userId,
        type,
        content,
        metadata: doc.metadata || {},
        timestamp: Date.now(),
      };
    });
  } catch (error) {
    console.error('Failed to get recent memories from Hyperspell:', error);
    return [];
  }
}

// Helper: Log a trade decision to memory
// Uses DUAL STORAGE: Convex (exact data) + Hyperspell (semantic search)
export async function logTradeDecision(params: {
  userId: string;
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  rationale?: string;
  aiRecommendation?: boolean;
  convexTradeId?: string; // Optional: ID from Convex if already stored
}) {
  // Store in Hyperspell for semantic search
  // Format as human-readable text for better semantic matching
  const humanReadableText = `${params.action.toUpperCase()} ${params.quantity} shares of ${params.ticker} at $${params.price.toFixed(2)}${params.rationale ? `. Reason: ${params.rationale}` : ''}`;

  // Store Convex trade ID in metadata so we can link back to exact data
  return addMemory({
    userId: params.userId,
    type: 'trade_decision',
    content: humanReadableText,
    metadata: {
      ticker: params.ticker,
      action: params.action,
      quantity: params.quantity,
      price: params.price,
      timestamp: Date.now(),
      convexTradeId: params.convexTradeId, // Link to Convex for exact retrieval
    },
  });
}

// Helper: Log AI recommendation to memory
export async function logAIRecommendation(params: {
  userId: string;
  ticker: string;
  question: string;
  recommendation: string;
  reasoning: string;
}) {
  return addMemory({
    userId: params.userId,
    type: 'ai_recommendation',
    content: {
      ticker: params.ticker,
      question: params.question,
      recommendation: params.recommendation,
      reasoning: params.reasoning,
      timestamp: Date.now(),
    },
    metadata: {
      ticker: params.ticker,
    },
  });
}

// Helper: Log user question to memory
export async function logUserQuestion(params: {
  userId: string;
  ticker?: string;
  question: string;
}) {
  return addMemory({
    userId: params.userId,
    type: 'user_question',
    content: {
      question: params.question,
      ticker: params.ticker,
      timestamp: Date.now(),
    },
    metadata: {
      ...(params.ticker && { ticker: params.ticker }),
    },
  });
}

// Helper: Get trading context for AI using DUAL STORAGE
// 1. Hyperspell finds relevant trades via semantic search
// 2. Retrieve exact data from Convex using the IDs
// 3. If Convex not available, fall back to Hyperspell metadata
export async function getTradingContext(params: {
  userId: string;
  ticker?: string;
  query: string;
  useConvex?: boolean; // Set to true to fetch exact data from Convex
}): Promise<string> {
  if (!process.env.HYPERSPELL_API_KEY) {
    console.warn('Hyperspell API key not configured, returning empty context');
    return 'No relevant trading history found.';
  }

  try {
    // Step 1: Use Hyperspell for semantic search to find relevant trades
    const response = await hyperspell.memories.search({
      query: params.query,
      sources: ['vault'],
      options: {
        max_results: 20,
        vault: {
          collection: params.userId,
        },
      } as any,
    });

    // Check for errors
    if (response.errors && response.errors.length > 0) {
      console.warn('[Hyperspell] Context retrieval errors:', response.errors);
    }

    if (!response.documents || response.documents.length === 0) {
      return 'No relevant trading history found.';
    }

    let context = 'RELEVANT TRADING HISTORY:\n\n';

    // Step 2: Try to get exact data from metadata
    for (const doc of response.documents) {
      const hyperspellDoc = doc as any;

      // First try to use exact metadata (stored when we logged the trade)
      if (hyperspellDoc.metadata) {
        const { ticker, action, quantity, price, timestamp } = hyperspellDoc.metadata;

        if (ticker && action && quantity !== undefined && price !== undefined) {
          // We have exact data from metadata!
          const date = timestamp ? new Date(timestamp).toLocaleDateString() : '';
          context += `- ${date ? date + ': ' : ''}${action.toUpperCase()} ${quantity} shares of ${ticker} at $${price.toFixed(2)}`;

          // Try to get rationale from the human-readable text
          const text = hyperspellDoc.highlights?.[0]?.text || hyperspellDoc.summary || '';
          const reasonMatch = text.match(/Reason:\s*(.+?)(?:\.|$)/i);
          if (reasonMatch) {
            context += ` (Reason: ${reasonMatch[1].trim()})`;
          }

          context += '\n';
          continue;
        }
      }

      // Fallback: Use Hyperspell's summary if metadata not available
      const text = hyperspellDoc.highlights?.[0]?.text || hyperspellDoc.summary || '';
      if (!text || text.length < 10) continue;

      let cleanText = text.replace(/TYPE:\w+\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim();
      context += `- ${cleanText}\n`;
    }

    // If we didn't add any memories, return not found
    if (context === 'RELEVANT TRADING HISTORY:\n\n') {
      return 'No relevant trading history found.';
    }

    return context;
  } catch (error) {
    console.error('Failed to get trading context from Hyperspell:', error);
    return 'No relevant trading history found.';
  }
}
