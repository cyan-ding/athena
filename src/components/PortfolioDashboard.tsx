"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Position {
  ticker: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: string;
}

interface Account {
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  equity: number;
}

export function PortfolioDashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch positions and account in parallel
      const [positionsRes, accountRes] = await Promise.all([
        fetch("/api/trading/positions"),
        fetch("/api/trading/account"),
      ]);

      if (!positionsRes.ok || !accountRes.ok) {
        throw new Error("Failed to fetch portfolio data");
      }

      const positionsData = await positionsRes.json();
      const accountData = await accountRes.json();

      setPositions(positionsData.positions || []);
      setAccount(accountData.account);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchData();

    // Set up polling every 30 seconds
    const intervalId = setInterval(() => {
      fetchData();
    }, 30000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleClosePosition = async (ticker: string) => {
    if (!confirm(`Close entire ${ticker} position?`)) return;

    try {
      const response = await fetch("/api/trading/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to close position");
      }

      // Refresh data
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading portfolio...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error: {error}</div>
        <div className="text-center mt-2">
          <Button onClick={fetchData} size="sm">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const totalPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
  const totalValue = account?.portfolioValue || 0;

  return (
    <div className="space-y-3">
      {/* Account Summary */}
      {account && (
        <Card className="p-3">
          <h3 className="font-semibold mb-2 text-sm">Account Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">Portfolio Value</div>
              <div className="text-sm font-semibold">
                ${account.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Cash</div>
              <div className="text-sm font-semibold">
                ${account.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Buying Power</div>
              <div className="text-sm font-semibold">
                ${account.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Total P&L</div>
              <div className={`text-sm font-semibold ${totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Positions */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Positions</h3>
          <Button onClick={fetchData} size="sm" variant="outline">
            Refresh
          </Button>
        </div>

        {positions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No open positions. Start trading to see your portfolio here.
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((position) => (
              <div
                key={position.ticker}
                className="border rounded p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold">{position.ticker}</div>
                    <div className="text-sm text-muted-foreground">
                      {position.quantity} shares @ ${position.avgEntryPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${position.marketValue.toFixed(2)}</div>
                    <div
                      className={`text-sm ${
                        position.unrealizedPL >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {position.unrealizedPL >= 0 ? "+" : ""}$
                      {position.unrealizedPL.toFixed(2)} (
                      {position.unrealizedPLPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClosePosition(position.ticker)}
                    className="text-xs"
                  >
                    Close Position
                  </Button>
                  <div className="text-xs text-muted-foreground flex items-center">
                    Current: ${position.currentPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
