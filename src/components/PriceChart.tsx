"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PriceChartProps {
  ticker: string;
  data: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  onTimeRangeSelect?: (start: number, end: number, question: string) => void;
  onLoadMoreData?: (earliestTimestamp: number) => Promise<void>;
  isLoadingMore?: boolean;
}

export function PriceChart({ ticker, data, onTimeRangeSelect, onLoadMoreData, isLoadingMore }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; startX: number; endX: number; startY: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [question, setQuestion] = useState("");
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const isLoadingRef = useRef(false);
  const lastLoadTriggerTime = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);
  const isFirstDataLoad = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Chart initialization - only runs once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: false,
        visible: true, // Ensure time scale is visible
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: false, // Disable to allow Shift+drag selection
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStart: number | null = null;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.shiftKey && chartContainerRef.current) {
        isDragging = true;
        const rect = chartContainerRef.current.getBoundingClientRect();
        dragStartX = event.clientX - rect.left;
        dragStartY = event.clientY - rect.top;
        const timeScale = chart.timeScale();
        const time = timeScale.coordinateToTime(dragStartX);
        if (time !== null) {
          dragStart = time as number;
          setIsSelecting(true);
          setShowQuestionInput(false);
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging && dragStart !== null && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        const timeScale = chart.timeScale();
        const time = timeScale.coordinateToTime(currentX);

        if (time !== null) {
          const start = dragStart < (time as number) ? dragStart : (time as number);
          const end = dragStart > (time as number) ? dragStart : (time as number);
          const left = dragStartX < currentX ? dragStartX : currentX;
          const top = dragStartY < currentY ? dragStartY : currentY;
          const width = dragStartX > currentX ? dragStartX - currentX : currentX - dragStartX;
          const height = dragStartY > currentY ? dragStartY - currentY : currentY - dragStartY;

          setSelectedRange({ start, end, startX: dragStartX, endX: currentX, startY: dragStartY, endY: currentY });
          setSelectionBox({ left, top, width, height });
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (isDragging && dragStart !== null && chartContainerRef.current) {
        isDragging = false;
        const rect = chartContainerRef.current.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        const timeScale = chart.timeScale();
        const time = timeScale.coordinateToTime(currentX);

        if (time !== null) {
          const start = dragStart < (time as number) ? dragStart : (time as number);
          const end = dragStart > (time as number) ? dragStart : (time as number);
          const left = dragStartX < currentX ? dragStartX : currentX;
          const top = dragStartY < currentY ? dragStartY : currentY;
          const width = dragStartX > currentX ? dragStartX - currentX : currentX - dragStartX;
          const height = dragStartY > currentY ? dragStartY - currentY : currentY - dragStartY;

          setSelectedRange({ start, end, startX: dragStartX, endX: currentX, startY: dragStartY, endY: currentY });
          setSelectionBox({ left, top, width, height });
          setIsSelecting(false);
          setShowQuestionInput(true);
        } else {
          // If coordinate is outside valid range, clear the selection
          setSelectedRange(null);
          setSelectionBox(null);
          setIsSelecting(false);
          setShowQuestionInput(false);
        }
        dragStart = null;
      }
    };

    if (chartContainerRef.current) {
      chartContainerRef.current.addEventListener("mousedown", handleMouseDown);
      chartContainerRef.current.addEventListener("mousemove", handleMouseMove);
      chartContainerRef.current.addEventListener("mouseup", handleMouseUp);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener("mousedown", handleMouseDown);
        chartContainerRef.current.removeEventListener("mousemove", handleMouseMove);
        chartContainerRef.current.removeEventListener("mouseup", handleMouseUp);
      }
      chart.remove();
    };
  }, []); // Empty dependency array - only run once on mount

  // Reset state when ticker changes or data is completely replaced
  useEffect(() => {
    lastLoadTriggerTime.current = null;
    hasInitializedRef.current = false;
    isFirstDataLoad.current = true;
  }, [ticker]); // Reset when ticker changes

  // Separate effect for handling visible time range changes
  // This only re-runs when the callback dependencies change, not when data changes
  useEffect(() => {
    if (!chartRef.current || !onLoadMoreData) return;

    const handleVisibleTimeRangeChange = () => {
      // Skip if already loading, no data, or not initialized
      if (isLoadingRef.current || isLoadingMore || data.length === 0 || !hasInitializedRef.current) {
        return;
      }

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the scroll check - wait 500ms after scrolling stops
      debounceTimerRef.current = setTimeout(() => {
        const timeScale = chartRef.current!.timeScale();
        const visibleRange = timeScale.getVisibleRange();

        if (!visibleRange) return;

        // Get the earliest timestamp in our current data (in seconds)
        const earliestDataTime = Math.min(...data.map(d => d.timestamp / 1000));
        const latestDataTime = Math.max(...data.map(d => d.timestamp / 1000));

        // Convert Time to number for comparison
        const visibleFrom = Number(visibleRange.from);

        // Simple threshold: 50% of the way from earliest to latest
        const midpoint = earliestDataTime + ((latestDataTime - earliestDataTime) / 2);

        // Only load more data if:
        // 1. User scrolled past the 50% midpoint
        // 2. We haven't already triggered a load for this timestamp or earlier
        if (visibleFrom <= midpoint) {
          const shouldTrigger = lastLoadTriggerTime.current === null ||
                                earliestDataTime < lastLoadTriggerTime.current;

          console.log('[PriceChart] Load check:', {
            visibleFrom: new Date(visibleFrom * 1000).toISOString(),
            earliestDataTime: new Date(earliestDataTime * 1000).toISOString(),
            lastLoadTriggerTime: lastLoadTriggerTime.current ? new Date(lastLoadTriggerTime.current * 1000).toISOString() : 'null',
            shouldTrigger
          });

          if (shouldTrigger) {
            console.log('[PriceChart] Triggering load more data');
            isLoadingRef.current = true;
            lastLoadTriggerTime.current = earliestDataTime;

            // Pass the actual earliest timestamp in milliseconds
            const earliestTimestampMs = Math.min(...data.map(d => d.timestamp));
            onLoadMoreData(earliestTimestampMs)
              .finally(() => {
                isLoadingRef.current = false;
              });
          }
        }
      }, 500); // 500ms debounce delay
    };

    const chart = chartRef.current;
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      // Clean up any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [onLoadMoreData, isLoadingMore]); // Removed 'data' dependency to prevent re-subscription

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const chartData = data
      .map((bar) => ({
        time: Number((bar.timestamp / 1000).toFixed(0)) as any,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
      // IMPORTANT: Sort by time ascending for lightweight-charts
      .sort((a, b) => a.time - b.time);

    console.log('[PriceChart] Setting chart data:', {
      dataPoints: chartData.length,
      earliest: new Date(chartData[0].time * 1000).toISOString(),
      latest: new Date(chartData[chartData.length - 1].time * 1000).toISOString(),
      isFirstLoad: isFirstDataLoad.current
    });

    // Store current visible range to preserve it (unless it's the very first load)
    let currentVisibleRange = null;
    if (chartRef.current && !isFirstDataLoad.current) {
      currentVisibleRange = chartRef.current.timeScale().getVisibleRange();
    }

    candlestickSeriesRef.current.setData(chartData);

    if (chartRef.current) {
      if (isFirstDataLoad.current) {
        // First load: fit content to show all data
        chartRef.current.timeScale().fitContent();
        isFirstDataLoad.current = false;
        console.log('[PriceChart] First load - fitting content');

        // Use setTimeout to ensure the fitContent has completed and the chart has stabilized
        // before we start listening for scroll events
        setTimeout(() => {
          hasInitializedRef.current = true;
          console.log('[PriceChart] Chart initialization complete, auto-load now enabled');
        }, 100);
      } else if (currentVisibleRange) {
        // Subsequent loads: preserve the visible range to prevent jumping
        chartRef.current.timeScale().setVisibleRange(currentVisibleRange);
        console.log('[PriceChart] Preserving visible range');
      }
    }
  }, [data, isLoadingMore]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showQuestionInput) {
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showQuestionInput]);

  const handleAskQuestion = () => {
    if (selectedRange && onTimeRangeSelect) {
      // Get price data for the selected time range
      const rangeData = data.filter(d => {
        const timestamp = d.timestamp / 1000;
        return timestamp >= selectedRange.start && timestamp <= selectedRange.end;
      });

      // Calculate price change info
      let priceInfo = "";
      if (rangeData.length > 0) {
        const firstPrice = rangeData[0].close;
        const lastPrice = rangeData[rangeData.length - 1].close;
        const priceChange = lastPrice - firstPrice;
        const percentChange = (priceChange / firstPrice) * 100;
        const highPrice = Math.max(...rangeData.map(d => d.high));
        const lowPrice = Math.min(...rangeData.map(d => d.low));

        priceInfo = `Price: $${firstPrice.toFixed(2)} → $${lastPrice.toFixed(2)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%). High: $${highPrice.toFixed(2)}, Low: $${lowPrice.toFixed(2)}.`;
      }

      // Combine user question with price info if there is a question, otherwise just use price info
      const enhancedQuestion = question.trim()
        ? `${question.trim()} [Time range: ${new Date(selectedRange.start * 1000).toLocaleDateString()} - ${new Date(selectedRange.end * 1000).toLocaleDateString()}. ${priceInfo}]`
        : `What happened during ${new Date(selectedRange.start * 1000).toLocaleDateString()} - ${new Date(selectedRange.end * 1000).toLocaleDateString()}? ${priceInfo}`;

      onTimeRangeSelect(selectedRange.start, selectedRange.end, enhancedQuestion);
      setQuestion("");
      setShowQuestionInput(false);
      setSelectionBox(null);
      setSelectedRange(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedRange(null);
    setSelectionBox(null);
    setShowQuestionInput(false);
    setQuestion("");
  };

  const containerWidth = chartContainerRef.current?.clientWidth || 800;
  const dialogLeft = selectionBox 
    ? (selectionBox.left + selectionBox.width / 2 - 150 < containerWidth - 320 
        ? selectionBox.left + selectionBox.width / 2 - 150 
        : containerWidth - 320)
    : 0;

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {ticker} • Daily Chart
          {isSelecting && <span className="ml-2 text-blue-600">(Selecting...)</span>}
          {isLoadingMore && <span className="ml-2 text-blue-600">(Loading more data...)</span>}
        </div>
        {selectedRange && !showQuestionInput && (
          <button
            onClick={handleClearSelection}
            className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
          >
            Clear Selection
          </button>
        )}
      </div>

      <div className="relative flex-1">
        <div
          ref={chartContainerRef}
          className="rounded border h-full"
          style={{ userSelect: "none", position: "relative", zIndex: 1 }}
        />

        {selectionBox && (
          <div
            className="absolute bg-blue-500/20 border-2 border-blue-500 pointer-events-none"
            style={{
              left: `${selectionBox.left}px`,
              top: `${selectionBox.top}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
              zIndex: 10,
            }}
          />
        )}

        {showQuestionInput && selectionBox && (
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-lg shadow-lg p-4 z-10"
            style={{
              left: `${dialogLeft}px`,
              top: "50%",
              transform: "translateY(-50%)",
              width: "300px",
            }}
          >
            <h4 className="text-sm font-semibold mb-2">Ask about this time range</h4>
            <div className="flex gap-2">
              <Input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                autoFocus
                className="flex-1"
              />
              <Button
                onClick={handleAskQuestion}
                size="sm"
              >
                Ask
              </Button>
            </div>
            <button
              onClick={handleClearSelection}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel (or press Esc)
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: Hold <kbd className="rounded bg-muted px-1">Shift</kbd> and drag diagonally to select a time range, then ask a question
      </div>
    </div>
  );
}
