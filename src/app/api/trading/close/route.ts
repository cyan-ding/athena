import { NextRequest, NextResponse } from 'next/server';
import { closePosition, getPosition } from '@/lib/alpaca';
import { addMemory } from '@/lib/hyperspell';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, userId = 'demo-user' } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker' },
        { status: 400 }
      );
    }

    // Get position before closing to calculate P&L
    const position = await getPosition(ticker);
    if (!position) {
      return NextResponse.json(
        { error: `No position found for ${ticker}` },
        { status: 404 }
      );
    }

    // Close the position
    const closeOrder = await closePosition(ticker);

    // Calculate P&L
    const pnl = parseFloat(position.unrealized_pl);
    const pnlPercent = parseFloat(position.unrealized_plpc) * 100;
    const exitPrice = parseFloat(position.current_price);

    // Log to Hyperspell memory (async, fire and forget)
    addMemory({
      userId,
      type: 'trade_closed',
      content: {
        ticker: ticker.toUpperCase(),
        quantity: parseFloat(position.qty),
        entryPrice: parseFloat(position.avg_entry_price),
        exitPrice,
        pnl,
        pnlPercent,
        timestamp: Date.now(),
      },
      metadata: {
        ticker: ticker.toUpperCase(),
        outcome: pnl >= 0 ? 'profit' : 'loss',
      },
    }).catch(err => console.error('Failed to log to Hyperspell:', err));

    return NextResponse.json({
      success: true,
      position: {
        ticker: ticker.toUpperCase(),
        quantity: parseFloat(position.qty),
        entryPrice: parseFloat(position.avg_entry_price),
        exitPrice,
        pnl,
        pnlPercent,
      },
      orderId: closeOrder.id,
    });
  } catch (error: any) {
    console.error('Error closing position:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to close position' },
      { status: 500 }
    );
  }
}
