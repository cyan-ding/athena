"use client";

import { useState, useEffect } from "react";
import { PriceChart } from "@/components/PriceChart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [useBrowserUse, setUseBrowserUse] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [selectedTimeStart, setSelectedTimeStart] = useState<number | null>(null);
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentTimespan, setCurrentTimespan] = useState<"hour" | "day">("day");
  const [earliestFetchedTimestamp, setEarliestFetchedTimestamp] = useState<number | null>(null);
  const [showCitations, setShowCitations] = useState(false);

  // Load default ticker on mount
  useEffect(() => {
    fetchMarketData(ticker, selectedTimeRange, true);
  }, []); // Empty dependency array means this runs once on mount

  const fetchMarketData = async (symbol: string, timeRange: TimeRange = selectedTimeRange, fromWatchlist: boolean = false) => {
    if (!fromWatchlist) {
      setLoading(true);
    }
    setError(null);

    try {
      const to = new Date().toISOString().split("T")[0];
      let daysBack = 180;
      let bufferDays = 60; // Extra buffer to pre-fetch
      let timespan = "day";

      switch (timeRange) {
        case "1D":
          daysBack = 1;
          bufferDays = 1;
          timespan = "hour";
          break;
        case "1W":
          daysBack = 7;
          bufferDays = 3;
          timespan = "hour";
          break;
        case "1M":
          daysBack = 30;
          bufferDays = 15;
          timespan = "day";
          break;
        case "3M":
          daysBack = 90;
          bufferDays = 30;
          timespan = "day";
          break;
        case "6M":
          daysBack = 180;
          bufferDays = 60;
          timespan = "day";
          break;
        case "1Y":
          daysBack = 365;
          bufferDays = 90;
          timespan = "day";
          break;
      }

      // Fetch main data + buffer in a single request
      const totalDays = daysBack + bufferDays;
      const from = new Date(Date.now() - totalDays * 24 * 60 * 60 * 1000)
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
      const fetchedData = result.data || [];

      setChartData(fetchedData);
      setTicker(symbol.toUpperCase());
      setSelectedTimeRange(timeRange);
      setCurrentTimespan(timespan as "hour" | "day");

      // Track the earliest timestamp we've fetched
      if (fetchedData.length > 0) {
        const earliest = Math.min(...fetchedData.map((d: any) => d.timestamp));
        setEarliestFetchedTimestamp(earliest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreData = async (earliestTimestamp: number) => {
    if (isLoadingMore || !ticker) return;

    // Check if we've already fetched data earlier than this timestamp
    // If so, don't re-fetch (caching mechanism)
    if (earliestFetchedTimestamp && earliestTimestamp >= earliestFetchedTimestamp) {
      console.log("Data already cached, skipping fetch");
      return;
    }

    setIsLoadingMore(true);

    try {
      // Calculate the time range based on current timespan
      let daysBack = 30;
      if (currentTimespan === "hour") {
        daysBack = 7; // Load another week for hourly data
      } else {
        // For daily data, load based on current time range
        switch (selectedTimeRange) {
          case "1M":
          case "3M":
            daysBack = 30;
            break;
          case "6M":
            daysBack = 60;
            break;
          case "1Y":
            daysBack = 90;
            break;
          default:
            daysBack = 30;
        }
      }

      // Calculate from/to dates for the previous period
      const earliestDate = new Date(earliestTimestamp);
      const to = new Date(earliestTimestamp - 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // One day before earliest
      const from = new Date(earliestDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const response = await fetch(
        `/api/market-data?ticker=${ticker}&from=${from}&to=${to}&timespan=${currentTimespan}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch historical data");
      }

      const result = await response.json();

      // Prepend new data to existing data, removing duplicates
      if (result.data && result.data.length > 0) {
        const newData = result.data;
        const existingTimestamps = new Set(chartData.map(d => d.timestamp));
        const uniqueNewData = newData.filter((d: any) => !existingTimestamps.has(d.timestamp));

        if (uniqueNewData.length > 0) {
          const updatedData = [...uniqueNewData, ...chartData];
          setChartData(updatedData);

          // Update the earliest fetched timestamp
          const newEarliest = Math.min(...updatedData.map((d: any) => d.timestamp));
          setEarliestFetchedTimestamp(newEarliest);
        }
      }
    } catch (err) {
      console.error("Error loading more data:", err);
      // Don't show error to user for background loading
    } finally {
      setIsLoadingMore(false);
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
      fetchMarketData(ticker, range, true);
    }
  };

  const handleTimeRangeSelect = async (start: number, end: number, userQuestion: string) => {
    console.log("Selected time range:", { start, end, question: userQuestion });
    setSelectedTimeStart(start);
    setSelectedTimeEnd(end);
    setQuestion(userQuestion);

    // Automatically submit the query
    setChatLoading(true);
    setChatResponse(null);
    setError(null);

    try {
      // Calculate time range
      const startDate = new Date(start * 1000).toISOString().split('T')[0];
      const endDate = new Date(end * 1000).toISOString().split('T')[0];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          ticker,
          startDate,
          endDate,
          useBrowserUse,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const data = await response.json();
      setChatResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRemoveFromWatchlist = (tickerToRemove: string) => {
    setWatchlist(watchlist.filter(t => t !== tickerToRemove));
  };

  const handleAskAthena = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    setChatLoading(true);
    setChatResponse(null);
    setError(null);

    try {
      // Calculate time range
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (selectedTimeStart && selectedTimeEnd) {
        startDate = new Date(selectedTimeStart * 1000).toISOString().split('T')[0];
        endDate = new Date(selectedTimeEnd * 1000).toISOString().split('T')[0];
      } else if (chartData.length > 0) {
        // Use full chart range
        const dates = chartData.map(d => d.time);
        startDate = new Date(Math.min(...dates) * 1000).toISOString().split('T')[0];
        endDate = new Date(Math.max(...dates) * 1000).toISOString().split('T')[0];
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          ticker,
          startDate,
          endDate,
          useBrowserUse,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const data = await response.json();
      setChatResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/file.svg"
              alt="Athena Logo"
              className="h-10 w-10"
            />
            <h1 className="text-2xl font-bold">Athena</h1>
          </div>
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
      <main className="flex flex-1 gap-4 p-6 overflow-hidden min-h-0">
        {/* Left Sidebar - Watchlist */}
        <aside className="w-64 rounded-lg border p-4 overflow-y-auto flex-shrink-0">
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
                  onLoadMoreData={handleLoadMoreData}
                  isLoadingMore={isLoadingMore}
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

        </div>

        {/* Right Sidebar - AI Chat */}
        <aside className="w-96 rounded-lg border flex flex-col flex-shrink-0 overflow-hidden">
          {/* Chat Header */}
          <div className="border-b p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Ask Athena</h2>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBrowserUse}
                  onChange={(e) => setUseBrowserUse(e.target.checked)}
                  className="rounded"
                />
                <span className="text-muted-foreground">
                  Social Scraping
                </span>
              </label>
            </div>
          </div>

          {/* Chat Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {error && (
              <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {chatLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    {useBrowserUse ? "Scraping social media..." : "Searching..."}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {useBrowserUse ? "This may take 10-20 seconds" : "Please wait"}
                  </div>
                </div>
              </div>
            )}

            {chatResponse && !chatLoading && (
              <div className="space-y-4">
                {/* Answer */}
                <div className="rounded-lg bg-muted/30 p-4 border">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    ANSWER
                  </div>
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {chatResponse.answer}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Sources */}
                {chatResponse.sources && chatResponse.sources.length > 0 && (
                  <div className="space-y-3">
                    {(() => {
                      // Separate Perplexity citations from other sources
                      const perplexitySources = chatResponse.sources.filter((s: any) => s.type === 'perplexity');
                      const otherSources = chatResponse.sources.filter((s: any) => s.type !== 'perplexity');

                      return (
                        <>
                          {/* Non-Perplexity Sources (EDGAR, Social, etc.) */}
                          {otherSources.length > 0 && (
                            <>
                              <div className="text-xs font-semibold text-muted-foreground">
                                PRIMARY SOURCES ({otherSources.length})
                              </div>
                              {otherSources.map((source: any) => (
                                <div
                                  key={source.id}
                                  className="rounded-lg border p-3 hover:bg-muted/20 transition-colors"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-primary text-primary-foreground">
                                            {source.id}
                                          </span>
                                          <span className="text-xs font-medium text-muted-foreground">
                                            {source.type.toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="mt-1 font-medium text-sm">
                                          {source.title}
                                        </div>
                                        {source.date && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {source.date}
                                          </div>
                                        )}
                                        {source.content && source.content.length > 0 && (
                                          <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                            {source.content}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {source.url && (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      >
                                        View source ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Perplexity Citations - Collapsible */}
                          {perplexitySources.length > 0 && (
                            <div className="border rounded-lg">
                              <button
                                onClick={() => setShowCitations(!showCitations)}
                                className="w-full p-3 text-left hover:bg-muted/20 transition-colors flex items-center justify-between"
                              >
                                <span className="text-xs font-semibold text-muted-foreground">
                                  View ({perplexitySources.length}) Web Citations
                                </span>
                                <span className="text-muted-foreground">
                                  {showCitations ? '▲' : '▼'}
                                </span>
                              </button>
                              {showCitations && (
                                <div className="border-t p-3 space-y-2">
                                  {perplexitySources.map((source: any) => (
                                    <div
                                      key={source.id}
                                      className="rounded border p-2 text-xs hover:bg-muted/10"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
                                          {source.id}
                                        </span>
                                        <span className="font-medium">{source.title}</span>
                                      </div>
                                      {source.url && (
                                        <a
                                          href={source.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline text-[10px] ml-6"
                                        >
                                          {source.url} ↗
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Warnings */}
                {chatResponse.metadata?.errors && chatResponse.metadata.errors.length > 0 && (
                  <div className="rounded-lg border-yellow-200 bg-yellow-50 p-3 text-xs">
                    <div className="font-semibold text-yellow-800 mb-1">
                      Warnings
                    </div>
                    <ul className="list-disc list-inside text-yellow-700 space-y-1">
                      {chatResponse.metadata.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Metadata */}
                {chatResponse.metadata && (
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span>
                        {chatResponse.metadata.sourceCount} sources •
                        {chatResponse.metadata.usedBrowserUse ? " Social scraping ON" : " Social scraping OFF"}
                      </span>
                      {chatResponse.metadata.usage && (
                        <span>
                          {chatResponse.metadata.usage.total_tokens} tokens
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!chatResponse && !chatLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <div className="text-sm text-muted-foreground mb-2">
                    Ask questions about {ticker || "stocks"}, market events, or company filings
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {useBrowserUse
                      ? "Social scraping enabled - responses may take 10-20 seconds"
                      : "Using Perplexity + EDGAR for fast responses"}
                  </div>
                  <div className="mt-4 space-y-1 text-xs text-muted-foreground text-left">
                    <div className="font-semibold mb-2">Try asking:</div>
                    <div>• "What are the main business risks?"</div>
                    <div>• "Why did the stock spike recently?"</div>
                    <div>• "What do analysts predict?"</div>
                    {selectedTimeStart && selectedTimeEnd && (
                      <div className="mt-2 italic">• "What happened in this time range?"</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input - Fixed at Bottom */}
          <div className="border-t p-4 flex-shrink-0 bg-background">
            {selectedTimeStart && selectedTimeEnd && (
              <div className="mb-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
                Selected: {new Date(selectedTimeStart * 1000).toLocaleDateString()} to {new Date(selectedTimeEnd * 1000).toLocaleDateString()}
              </div>
            )}

            <form onSubmit={handleAskAthena} className="flex gap-2">
              <Input
                type="text"
                placeholder={`Ask about ${ticker || "a stock"}...`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={chatLoading}
              />
              <Button type="submit" disabled={chatLoading || !question.trim()}>
                {chatLoading ? "..." : "Send"}
              </Button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
