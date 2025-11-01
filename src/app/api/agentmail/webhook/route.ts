import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { sendEmail } from "@/lib/agentmail";
import { parseUserIntent, extractMainContent } from "@/utils/intent-parser";
import { buildTradeConfirmationEmail } from "@/utils/email-templates";
import { placeMarketOrder } from '@/lib/alpaca';

/**
 * AgentMail webhook handler for inbound email messages
 * POST /api/agentmail/webhook
 *
 * Processes user replies to price alerts and executes mock trades
 */
export async function POST(req: NextRequest) {
  try {
    // Get webhook payload and headers
    const payload = await req.text();
    const headers = {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    };

    // Verify webhook signature
    const webhookSecret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] AGENTMAIL_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event;
    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(payload, headers) as any;
    } catch (err) {
      console.error("[Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log("[Webhook] Received event:", event.event_type);

    // Only process message.received events
    if (event.event_type !== "message.received") {
      return NextResponse.json({ received: true });
    }

    const message = event.message;
    const { from, text, html, thread_id, message_id, inbox_id } = message;

    console.log("[Webhook] Message from:", from);
    console.log("[Webhook] Thread ID:", thread_id);

    // Extract main content (ignore quoted replies)
    const mainContent = extractMainContent(text || html || "");
    console.log("[Webhook] Main content:", mainContent);

    // Parse user intent
    const intent = parseUserIntent(mainContent);
    console.log("[Webhook] Parsed intent:", intent);

    // Extract alert metadata from message labels
    // In production, we'd fetch the alert from Convex using thread_id
    // For demo, we'll extract from the labels or use mock data

    if (intent === "unclear") {
      // Ask for clarification
      await sendEmail({
        to: [from],
        subject: "Quick clarification needed",
        html: `
          <p>Hey! I didn't quite catch that.</p>
          <p>Could you reply with just <strong>"yes"</strong> or <strong>"no"</strong>?</p>
          <p>Thanks!</p>
        `,
        text: "Hey! I didn't quite catch that. Could you reply with just 'yes' or 'no'? Thanks!",
        replyToMessageId: message_id,
      });

      return NextResponse.json({ received: true, action: "clarification_sent" });
    }

    if (intent === "no") {
      // User declined the trade
      await sendEmail({
        to: [from],
        subject: "Got it, no action taken",
        html: `
          <p>No problem! I've dismissed this alert.</p>
          <p>I'll keep monitoring your portfolio and let you know about other opportunities. 📊</p>
        `,
        text: "No problem! I've dismissed this alert. I'll keep monitoring your portfolio and let you know about other opportunities.",
        replyToMessageId: message_id,
      });

      return NextResponse.json({ received: true, action: "trade_declined" });
    }

    // User confirmed the trade (intent === "yes")
    // Execute trade via Alpaca
    console.log("[Webhook] User confirmed trade, executing...");

    // Mock trade data (in production, fetch from the alert in Convex)
    const ticker = "NVDA"; // Extract from labels or DB
    const action = "buy"; // Extract from alert
    const quantity = 50;
    const price = 515.3;
    const timestamp = new Date().toLocaleString();

    // Execute actual trade via Alpaca API
    console.log("[Alpaca] Executing trade:", {
      ticker,
      action,
      quantity,
    });

    let alpacaResult;
    try {
      const alpacaOrder = await placeMarketOrder(ticker, quantity, action);


      if (!alpacaOrder.id) {
        throw new Error('Failed to execute trade');
      }

      alpacaResult = alpacaOrder;
      console.log("[Alpaca] Trade executed successfully:", alpacaResult);
    } catch (error) {
      console.error("[Alpaca] Trade execution failed:", error);

      // Send error notification to user
      await sendEmail({
        to: [from],
        subject: "Trade execution failed",
        html: `
          <p>I tried to execute your trade, but something went wrong:</p>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
          <p>Please check your account or contact support.</p>
        `,
        text: `Trade execution failed: ${error instanceof Error ? error.message : String(error)}`,
        replyToMessageId: message_id,
      });

      return NextResponse.json({
        received: true,
        action: "trade_failed",
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }

    // Get actual execution details from Alpaca
    const executedPrice = alpacaResult.filled_avg_price || price;
    const executedTotalValue = quantity * parseFloat(executedPrice);

    // Send confirmation email with actual trade details
    const confirmationEmail = buildTradeConfirmationEmail({
      ticker,
      action: action as "buy" | "sell",
      quantity,
      price: parseFloat(executedPrice),
      totalValue: executedTotalValue,
      timestamp,
    });

    await sendEmail({
      to: [from],
      subject: confirmationEmail.subject,
      html: confirmationEmail.html,
      text: confirmationEmail.text,
      replyToMessageId: message_id,
    });

    console.log("[Webhook] Trade confirmation sent");

    return NextResponse.json({
      received: true,
      action: "trade_executed",
      trade: {
        ticker,
        action,
        quantity,
        price: executedPrice,
        totalValue: executedTotalValue,
        alpacaOrderId: alpacaResult.id,
        status: alpacaResult.status,
      },
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      {
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
