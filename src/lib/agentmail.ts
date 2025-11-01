import { AgentMailClient } from "agentmail";

if (!process.env.AGENTMAIL_API_KEY) {
  throw new Error("AGENTMAIL_API_KEY is not set in environment variables");
}

export const agentmail = new AgentMailClient({
  apiKey: process.env.AGENTMAIL_API_KEY,
});

export const INBOX_ID = process.env.AGENTMAIL_INBOX_ID || "athena@agentmail.to";

// Helper to send emails with consistent formatting
export async function sendEmail({
  to,
  subject,
  html,
  text,
  labels = [],
  replyToMessageId,
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  labels?: string[];
  replyToMessageId?: string;
}) {
  try {
    if (replyToMessageId) {
      // Reply to existing message
      return await agentmail.inboxes.messages.reply(
        INBOX_ID,
        replyToMessageId,
        {
          html,
          text,
        }
      );
    } else {
      // Send new message
      return await agentmail.inboxes.messages.send(INBOX_ID, {
        to,
        subject,
        html,
        text,
        labels,
      });
    }
  } catch (error) {
    console.error("[AgentMail] Failed to send email:", error);
    throw error;
  }
}
