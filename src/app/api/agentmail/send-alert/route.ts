import { NextRequest, NextResponse } from "next/server";
import { sendEmail, INBOX_ID } from "@/lib/agentmail";
import { buildPriceAlertEmail } from "@/utils/email-templates";

/**
 * Demo endpoint to trigger a price alert email
 * POST /api/agentmail/send-alert
 *
 * Body:
 * {
 *   "userEmail": "user@example.com",
 *   "ticker": "NVDA",
 *   "currentPrice": 515.30,
 *   "changePercent": 12.3
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userEmail, ticker, currentPrice, changePercent } = body;

    // Validate inputs
    if (!userEmail || !ticker || !currentPrice || !changePercent) {
      return NextResponse.json(
        { error: "Missing required fields: userEmail, ticker, currentPrice, changePercent" },
        { status: 400 }
      );
    }

    // In a real implementation, we'd fetch the user from the database
    // For demo, we'll use mock data
    const mockUserId = "demo_user_123";

    // Mock user position data (in production, fetch from Convex portfolios table)
    const userShares = 0; // Assume starting from zero (buy narrative)
    const avgPrice = 0.0; // No average price, since user doesn't own yet
    const unrealizedPnL = 0; // No PnL if no position yet
    const unrealizedPnLPercent = 0;

    // Mock behavior pattern (in production, fetch from Hyperspell or tradingMemory)
    // Now focused on narrative of buying opportunities
    const behaviorPattern =
      changePercent < -10
        ? "You have a history of buying the dip when prices fall sharply."
        : "You've shown strong interest in this ticker but don't own a position yet.";

    // Determine suggested action: bias towards "buy" for this narrative
    const suggestedAction: "buy" | "sell" | "hold" = "buy";

    // Create price alert in Convex (would use actual mutation in production)
    const alertId = `alert_${Date.now()}`;

    // For demo, we'll directly create a mock alert
    const mockAlert = {
      userId: mockUserId,
      ticker,
      alertType: "percentage_change" as const,
      threshold: changePercent,
      currentPrice,
      emailSent: false,
      userResponse: undefined,
      suggestedAction,
      quantity: 20, // Suggest a default buy quantity
      executed: false,
      behaviorPattern,
      status: "pending" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Build email content, using buy suggestion and buy-focused context
    const emailContent = buildPriceAlertEmail({
      ticker,
      currentPrice,
      changePercent,
      userShares,
      avgPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      behaviorPattern,
      suggestedAction,
    });

    // Send email via AgentMail
    const message = await sendEmail({
      to: [userEmail],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      labels: [
        "price-alert",
        `ticker:${ticker}`,
        `user:${mockUserId}`,
        `alert:${alertId}`,
        `action:${suggestedAction}`,
      ],
    });

    console.log("[AgentMail] Buy alert sent:", {
      messageId: message.messageId,
      to: userEmail,
      ticker,
      suggestedAction,
    });

    // In production, update the alert record with the thread/message IDs
    // await convex.mutation(api.priceAlerts.update, {
    //   alertId,
    //   agentMailThreadId: message.thread_id,
    //   emailSent: true,
    //   status: "sent"
    // });

    return NextResponse.json({
      success: true,
      alertId,
      messageId: message.messageId,
      threadId: message.threadId,
      preview: {  
        ticker,
        currentPrice,
        changePercent,
        unrealizedPnL,
        unrealizedPnLPercent,
        suggestedAction,
      },
    });
  } catch (error) {
    console.error("[AgentMail] Error sending buy alert:", error);
    return NextResponse.json(
      {
        error: "Failed to send buy alert",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
