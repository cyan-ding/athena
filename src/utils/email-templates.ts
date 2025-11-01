/**
 * Email template utilities for AgentMail notifications
 * Conversational tone for user-friendly trading alerts
 * "Buy the Dip" - paints a narrative that the stock has plummeted and it's a good time to buy
 */

interface PriceAlertEmailData {
  ticker: string;
  currentPrice: number;
  changePercent: number;
  userShares: number;
  avgPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  behaviorPattern?: string;
  suggestedAction: "buy" | "sell" | "hold";
}

export function buildPriceAlertEmail(data: PriceAlertEmailData) {
  const {
    ticker,
    currentPrice,
    changePercent,
    userShares,
    avgPrice,
    unrealizedPnL,
    unrealizedPnLPercent,
    behaviorPattern,
  } = data;

  // Plummet narrative
  const isBigDrop = changePercent < -8;
  const dropEmoji = "💥";
  const dipEmoji = "🫧";
  const bargainEmoji = "🟢";
  const shockedEmoji = "😱";
  const emoji =
    isBigDrop
      ? `${dropEmoji}${shockedEmoji}`
      : (changePercent < 0 ? "📉" : "📈");
  const profitEmoji = unrealizedPnL > 0 ? "💰" : "📊";
  const actionEmoji = bargainEmoji;

  const subject = "NVDA Plummets 10% Today";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
    }
    .content {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .metric {
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      border-left: 4px solid #43e97b;
    }
    .metric-label {
      color: #6c757d;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      margin-top: 5px;
    }
    .insight {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .cta {
      background: white;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border: 2px solid #43e97b;
    }
    .cta-text {
      font-size: 16px;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
      color: #6c757d;
      font-size: 14px;
    }
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
  </style>
</head>
<body>
  <div class="header">
    <h1>
      ${emoji} ${ticker} Plummets!
    </h1>
  </div>

  <div class="content">
    <p>
      Whoa! <strong>${ticker}</strong> just <strong>dropped 10% today</strong> 
      ${isBigDrop 
        ? `<br><span style="font-size:22px;color:#dc3545;">${dropEmoji} Massive sell-off detected!</span><br><strong>Sharp drops like this can mean huge bargains for bold investors.</strong>`
        : "<br/><strong>The price just took a hit—bargain hunters take note!</strong>"
      }
    </p>

    <div class="metric">
      <div class="metric-label">Your Position</div>
      <div class="metric-value">${userShares} shares @ $${avgPrice.toFixed(2)} avg</div>
    </div>

    <div class="metric">
      <div class="metric-label">Unrealized P/L</div>
      <div class="metric-value ${unrealizedPnL > 0 ? "positive" : "negative"}">
        ${profitEmoji} ${unrealizedPnL > 0 ? "+" : ""}$${unrealizedPnL.toFixed(2)}
        (${unrealizedPnLPercent > 0 ? "+" : ""}${unrealizedPnLPercent.toFixed(1)}%)
      </div>
    </div>

    ${
      behaviorPattern
        ? `
    <div class="insight">
      <strong>🧠 Pattern Recognition:</strong> ${behaviorPattern} <br/>
      ${isBigDrop
        ? "<em>You've shown interest in buying when the crowd is fearful. This might be your moment.</em>"
        : "<em>Buying the dip could set you up for a strong recovery.</em>"
      }
    </div>
    `
        : isBigDrop
          ? `
    <div class="insight">
      <strong>🧠 Opportunity:</strong> Panic selling creates swift price drops, but seasoned investors know these moments often lead to strong rebounds. Is it time to buy the fear?
    </div>
    `
        : ""
    }

    <div class="cta">
      <div class="cta-text">
        ${actionEmoji} <strong>${isBigDrop ? "Ready to buy the dip on" : "Consider adding to"} ${ticker}?</strong>
      </div>
      <p style="margin: 15px 0 5px 0; color: #6c757d; font-size: 14px;">
        Just reply to this email with:
      </p>
      <ul style="margin: 5px 0; padding-left: 20px; color: #495057;">
        <li><strong>"yes"</strong> to buy (default: 50 shares)</li>
        <li><strong>"yes 100"</strong> to buy 100 shares</li>
        <li><strong>"no"</strong> to skip this alert</li>
      </ul>
      ${
        isBigDrop
          ? `<div style="color: #dc3545; margin-top: 10px;">
                ${dipEmoji} <strong>Big drops = big opportunities. Buy low when others are fearful.</strong>
             </div>`
          : ""
      }
    </div>

    <div class="footer">
      <p>This is an automated "buy the dip" alert from Athena, based on your trading patterns and timely market moves.</p>
      <p style="font-size: 12px; margin-top: 10px;">
        <em>Note: This is a demo using mock Alpaca trading. No real trades will be executed.</em>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${emoji} ${ticker} Plummets!

Whoa! ${ticker} just dropped to $${currentPrice.toFixed(2)} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% today).
${isBigDrop
  ? "That's a massive sell-off! History shows sharp drops often lead to outsized rebound opportunities for bold buyers."
  : "A noticeable dip has arrived—could this be your chance to buy low?"
}

Your Position:
- ${userShares} shares @ $${avgPrice.toFixed(2)} avg
- Unrealized P/L: ${unrealizedPnL > 0 ? "+" : ""}$${unrealizedPnL.toFixed(2)} (${
    unrealizedPnLPercent > 0 ? "+" : ""
  }${unrealizedPnLPercent.toFixed(1)}%)

${
  behaviorPattern
    ? `🧠 Pattern: ${behaviorPattern}\n${
        isBigDrop
          ? "You have a knack for buying when others panic. Will you take advantage again?"
          : "Buying the dip might give you a head start on the next rally."
      }`
    : isBigDrop
      ? "Market panic = opportunity for the bold. Will you buy the dip?"
      : ""
}

${isBigDrop
  ? "Ready to buy the dip? Reply \"yes\" to buy (default: 50 shares), \"yes 100\" to buy 100 shares, or \"no\" to skip."
  : "Want to add to your position? Reply \"yes\" to buy (default: 50 shares), \"yes 100\" to buy 100 shares, or \"no\" to skip."
}

---
This is a demo using mock Alpaca trading.
  `.trim();

  return { subject, html, text };
}

interface TradeConfirmationEmailData {
  ticker: string;
  action: "buy" | "sell";
  quantity: number;
  price: number;
  totalValue: number;
  timestamp: string;
}

export function buildTradeConfirmationEmail(data: TradeConfirmationEmailData) {
  const { ticker, action, quantity, price, totalValue, timestamp } = data;

  const emoji = action === "buy" ? "🟢" : "🔴";
  const actionText = action === "buy" ? "BUY" : "SELL";

  const subject = `✅ Trade Executed: ${actionText} ${quantity} ${ticker}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #28a745;
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .trade-detail {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
      color: #6c757d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Trade Confirmed</h1>
  </div>

  <div class="content">
    <p>Your trade has been executed successfully!</p>

    <div class="trade-detail">
      <span><strong>Action:</strong></span>
      <span>${emoji} ${actionText}</span>
    </div>

    <div class="trade-detail">
      <span><strong>Ticker:</strong></span>
      <span>${ticker}</span>
    </div>

    <div class="trade-detail">
      <span><strong>Quantity:</strong></span>
      <span>${quantity} shares</span>
    </div>

    <div class="trade-detail">
      <span><strong>Price:</strong></span>
      <span>$${price.toFixed(2)}</span>
    </div>

    <div class="trade-detail">
      <span><strong>Total Value:</strong></span>
      <span><strong>$${totalValue.toFixed(2)}</strong></span>
    </div>

    <div class="trade-detail">
      <span><strong>Executed At:</strong></span>
      <span>${timestamp}</span>
    </div>

    <div class="footer">
      <p><em>Note: This is a demo using mock Alpaca trading. No real money was moved.</em></p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
✅ Trade Confirmed

Your trade has been executed successfully!

Action: ${emoji} ${actionText}
Ticker: ${ticker}
Quantity: ${quantity} shares
Price: $${price.toFixed(2)}
Total Value: $${totalValue.toFixed(2)}
Executed At: ${timestamp}

---
Note: This is a demo using mock Alpaca trading.
  `.trim();

  return { subject, html, text };
}
