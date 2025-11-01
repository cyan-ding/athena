import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/alpaca';

export async function GET() {
  try {
    const account = await getAccount();

    // Transform to more usable format
    const formattedAccount = {
      accountNumber: account.account_number,
      status: account.status,
      currency: account.currency,
      cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value),
      buyingPower: parseFloat(account.buying_power),
      equity: parseFloat(account.equity),
      longMarketValue: parseFloat(account.long_market_value),
      shortMarketValue: parseFloat(account.short_market_value),
      daytradeCount: account.daytrade_count,
      patternDayTrader: account.pattern_day_trader,
    };

    return NextResponse.json({ account: formattedAccount });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch account information' },
      { status: 500 }
    );
  }
}
