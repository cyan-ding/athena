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
}

export function PriceChart({ ticker, data, onTimeRangeSelect }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; startX: number; endX: number; startY: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [question, setQuestion] = useState("");
  const [showQuestionInput, setShowQuestionInput] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
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
  }, []);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data.length) return;

    const chartData = data.map((bar) => ({
      time: Number((bar.timestamp / 1000).toFixed(0)) as any,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candlestickSeriesRef.current.setData(chartData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

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
    if (selectedRange && question.trim() && onTimeRangeSelect) {
      onTimeRangeSelect(selectedRange.start, selectedRange.end, question);
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
                placeholder="e.g., Why did the price spike?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                autoFocus
                className="flex-1"
              />
              <Button
                onClick={handleAskQuestion}
                disabled={!question.trim()}
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
