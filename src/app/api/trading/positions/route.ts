import { NextRequest, NextResponse } from 'next/server';
import { getPositions, getPosition } from '@/lib/alpaca';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (ticker) {
      // Get specific position
      const position = await getPosition(ticker);
      if (!position) {
        return NextResponse.json(
          { error: `No position found for ${ticker}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ position });
    }

    // Get all positions
    const positions = await getPositions();

    // Transform to more usable format
    const formattedPositions = positions.map((pos) => ({
      ticker: pos.symbol,
      quantity: parseFloat(pos.qty),
      avgEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      marketValue: parseFloat(pos.market_value),
      costBasis: parseFloat(pos.cost_basis),
      unrealizedPL: parseFloat(pos.unrealized_pl),
      unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
      side: pos.side,
    }));

    return NextResponse.json({ positions: formattedPositions });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
