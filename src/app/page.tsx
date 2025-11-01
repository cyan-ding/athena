"use client";

import { useState, useEffect, useRef } from "react";
import { PriceChart } from "@/components/PriceChart";
import { TradingPanel } from "@/components/TradingPanel";
import { PortfolioDashboard } from "@/components/PortfolioDashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession, signIn, signUp, signOut } from "@/lib/auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";

export default function Home() {
  const { data: session, isPending } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);

  const [ticker, setTicker] = useState("NVDA");
  const [searchInput, setSearchInput] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("6M");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [selectedTimeStart, setSelectedTimeStart] = useState<number | null>(null);
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentTimespan, setCurrentTimespan] = useState<"minute" | "hour" | "day">("day");
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
  const [earliestFetchedTimestamp, setEarliestFetchedTimestamp] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [collationProgress, setCollationProgress] = useState<{
    stage: string;
    progress: number;
    total: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [showWarnings, setShowWarnings] = useState(true);

  // Convex queries and mutations
  const userId = session?.user?.id || "guest";

  // Watchlist from Convex
  const watchlistData = useQuery(api.watchlists.get, { userId });
  const watchlist = watchlistData || ["NVDA", "TSLA", "AAPL"]; // Fallback to defaults
  const addToWatchlist = useMutation(api.watchlists.addTicker);
  const removeFromWatchlist = useMutation(api.watchlists.removeTicker);

  // User preferences from Convex
  const userPrefs = useQuery(api.userPreferences.get, { userId });
  const updatePreferences = useMutation(api.userPreferences.update);

  // Chat sessions from Convex
  const chatSessions = useQuery(api.chatSessions.list, { userId });
  const addChatMessage = useMutation(api.chatSessions.addMessage);
  const createChatSession = useMutation(api.chatSessions.create);

  // UI preferences (synced with Convex)
  const [useBrowserUse, setUseBrowserUse] = useState(userPrefs?.useBrowserUse ?? false);
  const [showCitations, setShowCitations] = useState(userPrefs?.showCitations ?? false);

  // Sync UI preferences with Convex when they change
  useEffect(() => {
    if (userPrefs !== undefined) {
      setUseBrowserUse(userPrefs?.useBrowserUse ?? false);
      setShowCitations(userPrefs?.showCitations ?? false);
    }
  }, [userPrefs]);

  // Load user preferences on mount or when they change
  useEffect(() => {
    if (userPrefs?.defaultTicker && ticker === "NVDA") {
      setTicker(userPrefs.defaultTicker);
    }
    if (userPrefs?.defaultTimeRange && selectedTimeRange === "6M") {
      setSelectedTimeRange(userPrefs.defaultTimeRange as TimeRange);
    }
  }, [userPrefs]);

  // Persist UI preferences to Convex when they change
  useEffect(() => {
    if (userPrefs !== undefined) {
      // Only update if value has actually changed
      if (userPrefs?.useBrowserUse !== useBrowserUse) {
        updatePreferences({ userId, useBrowserUse });
      }
    }
  }, [useBrowserUse]);

  useEffect(() => {
    if (userPrefs !== undefined) {
      if (userPrefs?.showCitations !== showCitations) {
        updatePreferences({ userId, showCitations });
      }
    }
  }, [showCitations]);

  // Persist ticker and time range preferences when they change
  // Use a ref to prevent infinite loops and only save after initial load
  const hasLoadedPrefs = useRef(false);

  useEffect(() => {
    if (userPrefs !== undefined) {
      hasLoadedPrefs.current = true;
    }
  }, [userPrefs]);

  useEffect(() => {
    if (hasLoadedPrefs.current && userPrefs !== undefined && ticker !== userPrefs?.defaultTicker) {
      updatePreferences({ userId, defaultTicker: ticker });
    }
  }, [ticker]);

  useEffect(() => {
    if (hasLoadedPrefs.current && userPrefs !== undefined && selectedTimeRange !== userPrefs?.defaultTimeRange) {
      updatePreferences({ userId, defaultTimeRange: selectedTimeRange });
    }
  }, [selectedTimeRange]);

  // Load most recent chat session on mount
  useEffect(() => {
    if (chatSessions && chatSessions.length > 0) {
      const mostRecentSession = chatSessions[0]; // Sessions are ordered by desc
      if (mostRecentSession.messages.length > 0) {
        // Get the last assistant message
        const lastAssistantMsg = [...mostRecentSession.messages]
          .reverse()
          .find(msg => msg.role === "assistant");

        if (lastAssistantMsg) {
          try {
            const parsedResponse = JSON.parse(lastAssistantMsg.content);
            setChatResponse(parsedResponse);
          } catch (err) {
            console.error("Failed to parse saved chat response:", err);
          }
        }
      }
    }
  }, [chatSessions]);

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
      setCurrentTimespan(timespan as "minute" | "hour" | "day");
      setCurrentMultiplier(1);

      // Track the earliest timestamp we've fetched
      if (fetchedData.length > 0) {
        const earliest = Math.min(...fetchedData.map((d: any) => d.timestamp));
        setEarliestFetchedTimestamp(earliest);

        // Set current price (most recent data point)
        const mostRecent = fetchedData[fetchedData.length - 1];
        setCurrentPrice(mostRecent?.close);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreData = async (earliestTimestamp: number) => {
    console.log('[handleLoadMoreData] Called with:', {
      earliestTimestamp: new Date(earliestTimestamp).toISOString(),
      earliestFetchedTimestamp: earliestFetchedTimestamp ? new Date(earliestFetchedTimestamp).toISOString() : 'null',
      isLoadingMore,
      ticker
    });

    if (isLoadingMore || !ticker) return;

    // Check if we've already fetched data earlier than this timestamp
    // If so, don't re-fetch (caching mechanism)
    // Skip only if we already have data earlier (smaller timestamp) than what's being requested
    if (earliestFetchedTimestamp && earliestFetchedTimestamp < earliestTimestamp) {
      console.log("[handleLoadMoreData] Data already cached, skipping fetch (have data back to", new Date(earliestFetchedTimestamp).toISOString(), ")");
      return;
    }

    console.log('[handleLoadMoreData] Starting fetch...');
    setIsLoadingMore(true);

    try {
      // Calculate the time range based on current timespan
      let daysBack = 30;
      if (currentTimespan === "minute") {
        daysBack = 1; // Load another day for minute data
      } else if (currentTimespan === "hour") {
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

      console.log('[handleLoadMoreData] Fetching:', {
        ticker,
        from,
        to,
        timespan: currentTimespan,
        multiplier: currentMultiplier,
        url: `/api/market-data?ticker=${ticker}&from=${from}&to=${to}&timespan=${currentTimespan}&multiplier=${currentMultiplier}`
      });

      const response = await fetch(
        `/api/market-data?ticker=${ticker}&from=${from}&to=${to}&timespan=${currentTimespan}&multiplier=${currentMultiplier}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch historical data");
      }

      const result = await response.json();
      console.log('[handleLoadMoreData] Raw API response:', result);

      // Prepend new data to existing data, removing duplicates
      if (result.data && result.data.length > 0) {
        const newData = result.data;
        const existingTimestamps = new Set(chartData.map(d => d.timestamp));
        const uniqueNewData = newData.filter((d: any) => !existingTimestamps.has(d.timestamp));

        console.log('[handleLoadMoreData] Received data:', {
          totalReceived: newData.length,
          uniqueNew: uniqueNewData.length,
          dateRange: uniqueNewData.length > 0 ? {
            from: new Date(Math.min(...uniqueNewData.map((d: any) => d.timestamp))).toISOString(),
            to: new Date(Math.max(...uniqueNewData.map((d: any) => d.timestamp))).toISOString()
          } : 'none'
        });

        if (uniqueNewData.length > 0) {
          const updatedData = [...uniqueNewData, ...chartData];
          setChartData(updatedData);

          // Update the earliest fetched timestamp
          const newEarliest = Math.min(...updatedData.map((d: any) => d.timestamp));
          setEarliestFetchedTimestamp(newEarliest);
          console.log('[handleLoadMoreData] Updated chart data, new earliest:', new Date(newEarliest).toISOString());
        }
      } else {
        console.log('[handleLoadMoreData] No new data received');
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

      // Auto-add to watchlist if not already there and not at max capacity
      if (!watchlist.includes(newTicker) && watchlist.length < 5) {
        addToWatchlist({ userId, ticker: newTicker });
      }

      setSearchInput("");
    }
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    if (ticker) {
      fetchMarketData(ticker, range, false); // Don't use fromWatchlist flag for manual time range changes
    }
  };

  const handleTimeRangeSelect = async (start: number, end: number, userQuestion: string) => {
    console.log("Selected time range:", { start, end, question: userQuestion });
    setSelectedTimeStart(start);
    setSelectedTimeEnd(end);
    setQuestion(userQuestion);

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    // Automatically submit the query
    setChatLoading(true);
    setChatResponse(null);
    setError(null);
    setCollationProgress(null);

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
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setCollationProgress({
                  stage: data.stage,
                  progress: data.progress,
                  total: data.total,
                });
              } else if (data.type === 'complete') {
                setChatResponse(data);
                setCollationProgress(null);

                // Save to Convex chat history (handleTimeRangeSelect)
                try {
                  await addChatMessage({
                    userId,
                    role: "user",
                    content: userQuestion,
                  });
                  await addChatMessage({
                    userId,
                    role: "assistant",
                    content: JSON.stringify(data),
                  });
                } catch (chatErr) {
                  console.error("Failed to save chat to Convex:", chatErr);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Chat request cancelled by user');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRemoveFromWatchlist = (tickerToRemove: string) => {
    removeFromWatchlist({ userId, ticker: tickerToRemove });
  };

  const handleCancelChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setChatLoading(false);
      setCollationProgress(null);
      setError("Request cancelled by user");
    }
  };

  const handleAskAthena = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    setChatLoading(true);
    setChatResponse(null);
    setError(null);
    setCollationProgress(null);

    try {
      // Calculate time range
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (selectedTimeStart && selectedTimeEnd) {
        startDate = new Date(selectedTimeStart * 1000).toISOString().split('T')[0];
        endDate = new Date(selectedTimeEnd * 1000).toISOString().split('T')[0];
      } else if (chartData.length > 0) {
        // Use full chart range - timestamps are in milliseconds
        const timestamps = chartData.map(d => d.timestamp);
        startDate = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
        endDate = new Date(Math.max(...timestamps)).toISOString().split('T')[0];
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
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setCollationProgress({
                  stage: data.stage,
                  progress: data.progress,
                  total: data.total,
                });
              } else if (data.type === 'complete') {
                setChatResponse(data);
                setCollationProgress(null);

                // Save to Convex chat history (handleAskAthena)
                try {
                  await addChatMessage({
                    userId,
                    role: "user",
                    content: question,
                  });
                  await addChatMessage({
                    userId,
                    role: "assistant",
                    content: JSON.stringify(data),
                  });
                } catch (chatErr) {
                  console.error("Failed to save chat to Convex:", chatErr);
                }
              }
            }
          }
        }
      }

      // Reset textarea height after successful submission
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Chat request cancelled by user');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);

    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Set height based on scrollHeight, but cap at maxHeight
      const maxHeight = 72; // 3 lines approximately
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Auth handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === "signup") {
        await signUp.email({
          email,
          password,
          name,
        });
      } else {
        await signIn.email({
          email,
          password,
        });
      }
      setShowAuthModal(false);
      setEmail("");
      setPassword("");
      setName("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSendDemoAlert = async () => {
    if (!session?.user?.email) {
      setAuthError("Please sign in to receive demo alerts");
      setShowAuthModal(true);
      return;
    }

    setAlertLoading(true);
    setAlertSuccess(false);

    try {
      const response = await fetch('/api/agentmail/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: session.user.email,
          ticker: 'NVDA',
          currentPrice: 515.30,
          changePercent: 12.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send alert');
      }

      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 5000);
    } catch (err) {
      console.error('Alert error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send alert');
    } finally {
      setAlertLoading(false);
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

            {isPending ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : session ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendDemoAlert}
                  disabled={alertLoading}
                >
                  {alertLoading ? "Sending..." : alertSuccess ? "✓ Alert Sent!" : "Demo Alert"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {session.user?.email || session.user?.name || "User"}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex flex-1 gap-4 p-6 overflow-hidden min-h-0">
        {/* Left Sidebar - Watchlist + Portfolio */}
        <aside className="w-64 rounded-lg border flex flex-col overflow-hidden flex-shrink-0">
          {/* Watchlist Section - Fixed height */}
          <div className="p-4 border-b flex-shrink-0">
            <h2 className="mb-4 font-semibold">Watchlist</h2>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const tickerItem = watchlist[index];
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between group h-8"
                  >
                    {tickerItem ? (
                      <>
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
                      </>
                    ) : (
                      <div className="flex-1 rounded px-2 py-1 text-sm text-muted-foreground/40">
                        —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Portfolio Section - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <PortfolioDashboard />
          </div>
        </aside>

        {/* Center - Chart + Trading Area */}
        <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-hidden">
          {/* Chart */}
          <div className="rounded-lg border p-4 flex flex-col overflow-hidden flex-1">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold">Price Chart</h2>

              {/* Time Range Buttons */}
              <div className="flex gap-1">
                {(["1D", "1W", "1M", "3M", "6M", "1Y"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => handleTimeRangeChange(range)}
                    disabled={loading}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
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
              <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-600 flex-shrink-0 relative">
                <button
                  onClick={() => setError(null)}
                  className="absolute top-1 right-1 text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
                {error}
                <p className="mt-1 text-xs">
                  Tip: If you hit rate limits, wait 60 seconds before trying again
                </p>
              </div>
            )}

            <div className="flex-1 min-h-[400px] overflow-hidden flex-shrink">
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
                    <p className="text-muted-foreground text-sm">
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

          {/* Trading Panel - Compact */}
          {ticker && (
            <div className="flex-shrink-0">
              <TradingPanel ticker={ticker} currentPrice={currentPrice} />
            </div>
          )}
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
              <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 relative">
                <button
                  onClick={() => setError(null)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 font-bold text-xl leading-none"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
                <div className="pr-6">{error}</div>
              </div>
            )}

            {chatLoading && (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="w-full max-w-sm space-y-4">
                  {collationProgress ? (
                    <>
                      <div className="text-sm font-medium text-center">
                        {collationProgress.stage}
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-300 ease-out"
                            style={{
                              width: `${(collationProgress.progress / collationProgress.total) * 100}%`
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Step {collationProgress.progress} of {collationProgress.total}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">
                        {useBrowserUse ? "Scraping social media..." : "Searching..."}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {useBrowserUse ? "This may take 10-20 seconds" : "Please wait"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {chatResponse && !chatLoading && (
              <div className="space-y-4">
                {/* Memory Indicator */}
                {chatResponse.metadata?.hasMemory && (
                  <div className="rounded-lg bg-blue-50 border-blue-200 border p-3 text-xs text-blue-800">
                    <div className="font-semibold mb-1">Memory Active</div>
                    <div>Athena is using your trading history to personalize this response.</div>
                  </div>
                )}

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
                {showWarnings && chatResponse.metadata?.errors && chatResponse.metadata.errors.length > 0 && (
                  <div className="rounded-lg border-yellow-200 bg-yellow-50 p-3 text-xs relative">
                    <button
                      onClick={() => setShowWarnings(false)}
                      className="absolute top-2 right-2 text-yellow-600 hover:text-yellow-800 font-bold text-xl leading-none"
                      aria-label="Dismiss warnings"
                    >
                      ×
                    </button>
                    <div className="font-semibold text-yellow-800 mb-1">
                      Warnings
                    </div>
                    <ul className="list-disc list-inside text-yellow-700 space-y-1 pr-6">
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

            <form onSubmit={handleAskAthena} className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                placeholder={`Ask about ${ticker || "a stock"}...`}
                value={question}
                onChange={handleTextareaChange}
                disabled={chatLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAskAthena(e as any);
                  }
                }}
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto"
                style={{
                  height: '40px',
                  maxHeight: '72px',
                  lineHeight: '1.5'
                }}
                rows={1}
              />
              <Button
                type={chatLoading ? "button" : "submit"}
                onClick={chatLoading ? handleCancelChat : undefined}
                disabled={!chatLoading && !question.trim()}
                className="h-10"
                variant={chatLoading ? "destructive" : "default"}
              >
                {chatLoading ? "Cancel" : "Send"}
              </Button>
            </form>
          </div>
        </aside>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {authMode === "signin" ? "Sign In" : "Sign Up"}
              </h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading
                  ? "Loading..."
                  : authMode === "signin"
                  ? "Sign In"
                  : "Sign Up"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {authMode === "signin" ? (
                <span>
                  Don't have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                    }}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthError(null);
                    }}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
