import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/alpaca';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'open' | 'closed' | 'all' | null;
    const limit = searchParams.get('limit');

    const orders = await getOrders({
      status: status || 'all',
      limit: limit ? parseInt(limit) : 50,
    });

    // Transform to more usable format
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      clientOrderId: order.client_order_id,
      ticker: order.symbol,
      quantity: parseFloat(order.qty),
      side: order.side,
      type: order.type,
      status: order.status,
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
      stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
      filledPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : undefined,
      filledQuantity: parseFloat(order.filled_qty),
      createdAt: new Date(order.created_at).getTime(),
      updatedAt: new Date(order.updated_at).getTime(),
      filledAt: order.filled_at ? new Date(order.filled_at).getTime() : undefined,
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error: any) {
    console.error('Error fetching order history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order history' },
      { status: 500 }
    );
  }
}
