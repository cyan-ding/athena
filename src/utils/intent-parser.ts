/**
 * Flexible intent parser for email replies
 * Handles various affirmative/negative responses
 */

export type UserIntent = "yes" | "no" | "unclear";

export interface ParsedResponse {
  intent: UserIntent;
  quantity?: number; // Number of shares if specified
}

const AFFIRMATIVE_PATTERNS = [
  /^yes$/i,
  /^yeah$/i,
  /^yep$/i,
  /^yup$/i,
  /^sure$/i,
  /^ok$/i,
  /^okay$/i,
  /^do it$/i,
  /^go ahead$/i,
  /^proceed$/i,
  /^confirm$/i,
  /^confirmed$/i,
  /^approve$/i,
  /^approved$/i,
  /^sell$/i,
  /^buy$/i,
  /^execute$/i,
  /^let's go$/i,
  /^affirmative$/i,
  /^absolutely$/i,
  /^definitely$/i,
  /^for sure$/i,
  /^why not$/i,
  /^sounds good$/i,
  /^looks good$/i,
  /^👍/,
  /^✅/,
  // Patterns with numbers/quantities
  /^yes\s+\d+/i,
  /^yeah\s+\d+/i,
  /^buy\s+\d+/i,
  /^okay\s+\d+/i,
  /^\d+\s+(shares?|stocks?|units?)/i,
];

const NEGATIVE_PATTERNS = [
  /^no$/i,
  /^nope$/i,
  /^nah$/i,
  /^not now$/i,
  /^cancel$/i,
  /^stop$/i,
  /^don't$/i,
  /^dont$/i,
  /^hold$/i,
  /^wait$/i,
  /^skip$/i,
  /^dismiss$/i,
  /^reject$/i,
  /^declined?$/i,
  /^pass$/i,
  /^negative$/i,
  /^nevermind$/i,
  /^never mind$/i,
  /^👎/,
  /^❌/,
];

/**
 * Parse user's email reply to determine intent
 * @param text - The email body text from the user
 * @returns "yes" | "no" | "unclear"
 */
export function parseUserIntent(text: string): UserIntent {
  // Clean up the text
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;]+$/, "") // Remove trailing punctuation
    .replace(/^(re:|fwd:)\s*/i, ""); // Remove email prefixes

  // Check affirmative patterns
  for (const pattern of AFFIRMATIVE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return "yes";
    }
  }

  // Check negative patterns
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return "no";
    }
  }

  // If the message is very short and contains yes/no, try to extract
  // But avoid false positives like "I'm not sure" or "I'm unsure"
  if (cleaned.length < 50) {
    // Check for negative context first
    if (/not sure|unsure|don't know|uncertain|maybe/i.test(cleaned)) {
      return "unclear";
    }

    // Check for affirmative keywords with optional punctuation and additional text
    if (/\b(yes|yeah|yep|sure|okay|ok)\b/i.test(cleaned)) {
      return "yes";
    }
    if (/\bno\b|\bnope\b|\bnah\b/i.test(cleaned)) {
      return "no";
    }
  }

  return "unclear";
}

/**
 * Extract quantity from user response
 * Handles formats like: "yes 50", "buy 25", "100 shares", "buy 10 stocks"
 */
function extractQuantity(text: string): number | undefined {
  // Clean up the text
  const cleaned = text.trim().toLowerCase();

  // Pattern 1: "yes/buy/etc NUMBER" or "NUMBER shares/stocks"
  // Matches: "yes 50", "buy 25", "100 shares", "50 stocks", "25"
  const patterns = [
    /(?:yes|yeah|yep|buy|purchase|get)\s+(\d+)/i,
    /(\d+)\s*(?:shares?|stocks?|units?)?/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const quantity = parseInt(match[1], 10);
      // Sanity check: quantity should be reasonable (1-10000)
      if (quantity > 0 && quantity <= 10000) {
        return quantity;
      }
    }
  }

  return undefined;
}

/**
 * Parse user's email reply to extract both intent and quantity
 * @param text - The email body text from the user
 * @returns ParsedResponse with intent and optional quantity
 */
export function parseUserResponse(text: string): ParsedResponse {
  const intent = parseUserIntent(text);
  const quantity = extractQuantity(text);

  return {
    intent,
    quantity,
  };
}

/**
 * Extract the main content from an email, removing quoted replies
 */
export function extractMainContent(emailBody: string): string {
  // Split by common email quote markers
  const lines = emailBody.split("\n");
  const mainLines: string[] = [];

  for (const line of lines) {
    // Stop at common quote indicators
    if (
      line.startsWith(">") ||
      line.startsWith("On ") ||
      line.includes("wrote:") ||
      line.includes("-----Original Message-----")
    ) {
      break;
    }
    mainLines.push(line);
  }

  return mainLines.join("\n").trim();
}
