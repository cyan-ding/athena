import Alpaca from '@alpacahq/alpaca-trade-api';

// Initialize Alpaca client for paper trading
export function getAlpacaClient() {
  if (!process.env.ALPACA_PAPER_API_KEY || !process.env.ALPACA_PAPER_SECRET_KEY) {
    throw new Error('Alpaca API credentials not configured');
  }

  return new Alpaca({
    keyId: process.env.ALPACA_PAPER_API_KEY,
    secretKey: process.env.ALPACA_PAPER_SECRET_KEY,
    paper: true,
    usePolygon: false,
  });
}

// Helper types
export interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: 'long' | 'short';
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
  filled_avg_price?: string;
  filled_qty: string;
  created_at: string;
  updated_at: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  filled_at?: string;
}

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: string;
  portfolio_value: string;
  buying_power: string;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
}

// Place a market order
export async function placeMarketOrder(
  symbol: string,
  qty: number,
  side: 'buy' | 'sell'
) {
  const alpaca = getAlpacaClient();

  const order = await alpaca.createOrder({
    symbol,
    qty,
    side,
    type: 'market',
    time_in_force: 'day',
  });

  return order;
}

// Place a limit order
export async function placeLimitOrder(
  symbol: string,
  qty: number,
  side: 'buy' | 'sell',
  limitPrice: number
) {
  const alpaca = getAlpacaClient();

  const order = await alpaca.createOrder({
    symbol,
    qty,
    side,
    type: 'limit',
    time_in_force: 'day',
    limit_price: limitPrice,
  });

  return order;
}

// Get all positions
export async function getPositions(): Promise<AlpacaPosition[]> {
  const alpaca = getAlpacaClient();
  const positions = await alpaca.getPositions();
  return positions;
}

// Get a specific position
export async function getPosition(symbol: string): Promise<AlpacaPosition | null> {
  const alpaca = getAlpacaClient();
  try {
    const position = await alpaca.getPosition(symbol);
    return position;
  } catch (error: any) {
    // Position not found
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// Close a position
export async function closePosition(symbol: string) {
  const alpaca = getAlpacaClient();
  const order = await alpaca.closePosition(symbol);
  return order;
}

// Get account information
export async function getAccount(): Promise<AlpacaAccount> {
  const alpaca = getAlpacaClient();
  const account = await alpaca.getAccount();
  return account;
}

// Get order by ID
export async function getOrder(orderId: string): Promise<AlpacaOrder> {
  const alpaca = getAlpacaClient();
  const order = await alpaca.getOrder(orderId);
  return order;
}

// Get all orders
export async function getOrders(params?: {
  status?: 'open' | 'closed' | 'all';
  limit?: number;
  after?: string;
  until?: string;
}): Promise<AlpacaOrder[]> {
  const alpaca = getAlpacaClient();
  const orders = await alpaca.getOrders(params as any);
  return orders;
}

// Cancel an order
export async function cancelOrder(orderId: string) {
  const alpaca = getAlpacaClient();
  await alpaca.cancelOrder(orderId);
}
