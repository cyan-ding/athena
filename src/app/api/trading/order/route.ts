import { NextRequest, NextResponse } from 'next/server';
import { placeMarketOrder, placeLimitOrder } from '@/lib/alpaca';
import { logTradeDecision } from '@/lib/hyperspell';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ticker,
      quantity,
      side,
      orderType = 'market',
      limitPrice,
      rationale,
      aiRecommendation,
      userQuestion,
      userId = 'demo-user', // TODO: Replace with actual auth
    } = body;

    // Validation
    if (!ticker || !quantity || !side) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, quantity, side' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (orderType === 'limit' && !limitPrice) {
      return NextResponse.json(
        { error: 'Limit price required for limit orders' },
        { status: 400 }
      );
    }

    // Place order with Alpaca
    let alpacaOrder;
    if (orderType === 'limit') {
      alpacaOrder = await placeLimitOrder(ticker, quantity, side, limitPrice);
    } else {
      alpacaOrder = await placeMarketOrder(ticker, quantity, side);
    }

    // Get the filled price (or use limit price for pending orders)
    const entryPrice = alpacaOrder.filled_avg_price
      ? parseFloat(alpacaOrder.filled_avg_price)
      : limitPrice || 0;

    // Log to Hyperspell memory (async, fire and forget)
    logTradeDecision({
      userId,
      ticker: ticker.toUpperCase(),
      action: side,
      quantity,
      price: entryPrice,
      rationale,
      aiRecommendation,
    }).catch(err => console.error('Failed to log to Hyperspell:', err));

    return NextResponse.json({
      success: true,
      trade: {
        alpacaOrderId: alpacaOrder.id,
        ticker: ticker.toUpperCase(),
        side,
        quantity,
        orderType,
        status: alpacaOrder.status,
        entryPrice,
      },
    });
  } catch (error: any) {
    console.error('Error placing order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place order' },
      { status: 500 }
    );
  }
}
