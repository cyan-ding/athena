/**
 * Flexible intent parser for email replies
 * Handles various affirmative/negative responses
 */

export type UserIntent = "yes" | "no" | "unclear";

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
  if (cleaned.length < 50) {
    if (/\byes\b|\byeah\b|\byep\b|\bsure\b/i.test(cleaned)) {
      return "yes";
    }
    if (/\bno\b|\bnope\b|\bnah\b/i.test(cleaned)) {
      return "no";
    }
  }

  return "unclear";
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
