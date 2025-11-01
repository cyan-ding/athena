"use client";

import { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";

export default function Home() {
  const [ticker, setTicker] = useState("NVDA");
  const [searchInput, setSearchInput] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("6M");
  const [question, setQuestion] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(["NVDA", "TSLA", "AAPL"]);

  const fetchMarketData = async (symbol: string, timeRange: TimeRange = selectedTimeRange, fromWatchlist: boolean = false) => {
    if (!fromWatchlist) {
      setLoading(true);
    }
    setError(null);

    try {
      const to = new Date().toISOString().split("T")[0];
      let daysBack = 180;
      let timespan = "day";

      switch (timeRange) {
        case "1D":
          daysBack = 1;
          timespan = "hour";
          break;
        case "1W":
          daysBack = 7;
          timespan = "hour";
          break;
        case "1M":
          daysBack = 30;
          timespan = "day";
          break;
        case "3M":
          daysBack = 90;
          timespan = "day";
          break;
        case "6M":
          daysBack = 180;
          timespan = "day";
          break;
        case "1Y":
          daysBack = 365;
          timespan = "day";
          break;
      }

      const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const response = await fetch(
        `/api/market-data?ticker=${symbol}&from=${from}&to=${to}&timespan=${timespan}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch market data");
      }

      const result = await response.json();
      setChartData(result.data || []);
      setTicker(symbol.toUpperCase());
      setSelectedTimeRange(timeRange);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const newTicker = searchInput.trim().toUpperCase();
      fetchMarketData(newTicker);
      
      // Auto-add to watchlist if not already there
      if (!watchlist.includes(newTicker)) {
        setWatchlist([...watchlist, newTicker]);
      }
      
      setSearchInput("");
    }
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    if (ticker) {
      fetchMarketData(ticker, range);
    }
  };

  const handleTimeRangeSelect = (start: number, end: number, userQuestion: string) => {
    console.log("Selected time range:", { start, end, question: userQuestion });
    setQuestion(userQuestion);
    // This will trigger AI explanation in Phase 2
  };

  const handleRemoveFromWatchlist = (tickerToRemove: string) => {
    setWatchlist(watchlist.filter(t => t !== tickerToRemove));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Athena</h1>
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Search ticker (e.g., NVDA)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-48"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Load"}
              </Button>
            </form>
            <span className="text-sm text-muted-foreground">Demo User</span>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex flex-1 gap-4 p-6 overflow-hidden">
        {/* Left Sidebar - Watchlist */}
        <aside className="w-64 rounded-lg border p-4 overflow-y-auto">
          <h2 className="mb-4 font-semibold">Watchlist</h2>
          <div className="space-y-2">
            {watchlist.map((tickerItem) => (
              <div
                key={tickerItem}
                className="flex items-center justify-between group"
              >
                <button
                  onClick={() => fetchMarketData(tickerItem, selectedTimeRange, true)}
                  className={`flex-1 rounded px-2 py-1 text-left text-sm hover:bg-muted ${ticker === tickerItem ? 'bg-muted font-medium' : ''}`}
                >
                  {tickerItem}
                </button>
                <button
                  onClick={() => handleRemoveFromWatchlist(tickerItem)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive px-1"
                  title={`Remove ${tickerItem}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Center - Chart Area */}
        <div className="flex flex-1 flex-col gap-4 min-h-0">
          {/* Chart */}
          <div className="rounded-lg border p-6 flex flex-col overflow-hidden" style={{ flex: '1 1 0', minHeight: 0 }}>
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-semibold">Price Chart</h2>
              {/* Time Range Buttons */}
              <div className="flex gap-1">
                {(["1D", "1W", "1M", "3M", "6M", "1Y"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => handleTimeRangeChange(range)}
                    disabled={loading}
                    className={`rounded px-3 py-1 text-sm transition-colors ${
                      selectedTimeRange === range
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 flex-shrink-0">
                {error}
                <p className="mt-1 text-xs">
                  Tip: If you hit rate limits, wait 60 seconds before trying again
                </p>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex-shrink">
              {chartData.length > 0 ? (
                <PriceChart
                  ticker={ticker}
                  data={chartData}
                  onTimeRangeSelect={handleTimeRangeSelect}
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded bg-muted/20">
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      {loading
                        ? "Loading chart data..."
                        : "Search for a ticker to view the chart"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Try: NVDA, TSLA, AAPL
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Chat Interface */}
          <div className="rounded-lg border p-4 flex-shrink-0 min-h-[120px]">
            <h3 className="mb-2 font-semibold">Ask Athena</h3>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder='Try: "Why did NVDA spike in April 2023?"'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled
              />
              <Button disabled>Send</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              AI chat coming in Phase 2
            </p>
          </div>
        </div>

        {/* Right Sidebar - Portfolio Summary */}
        <aside className="w-80 rounded-lg border p-4 overflow-y-auto">
          <h2 className="mb-4 font-semibold">Portfolio</h2>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="text-sm text-muted-foreground">Total Value</div>
              <div className="text-2xl font-bold">$0.00</div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>No positions yet</p>
              <p className="mt-2 text-xs">
                Import CSV or add positions manually
              </p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
