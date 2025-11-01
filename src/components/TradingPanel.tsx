"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface TradingPanelProps {
  ticker: string;
  currentPrice?: number;
}

export function TradingPanel({ ticker, currentPrice }: TradingPanelProps) {
  const [quantityInput, setQuantityInput] = useState("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleQuantityChange = (value: string) => {
    // Allow empty string or valid numbers
    if (value === "" || /^\d*$/.test(value)) {
      setQuantityInput(value);
    }
  };

  const quantity = parseInt(quantityInput) || 0;
  const isValidQuantity = quantity > 0;
  const isValidLimitPrice = orderType === "market" || (limitPrice && parseFloat(limitPrice) > 0);
  const canTrade = isValidQuantity && isValidLimitPrice && !loading;

  const handleTrade = async (side: "buy" | "sell") => {
    if (!canTrade) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          quantity,
          side,
          orderType,
          limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to place order");
      }

      const data = await response.json();
      setSuccess(
        `${side.toUpperCase()} order placed: ${quantity} shares of ${ticker} at ${
          orderType === "market" ? "market price" : `$${limitPrice}`
        }`
      );

      // Reset form
      setQuantityInput("1");
      setLimitPrice("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const estimatedCost = currentPrice && isValidQuantity
    ? orderType === "limit" && limitPrice
      ? parseFloat(limitPrice) * quantity
      : currentPrice * quantity
    : null;

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-semibold text-xs">Trade {ticker}</h3>
        {currentPrice && (
          <span className="text-[10px] text-muted-foreground">${currentPrice.toFixed(2)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* Order Type Selection */}
        <div className="col-span-2 flex gap-1">
          <button
            onClick={() => setOrderType("market")}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10px] ${
              orderType === "market"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType("limit")}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10px] ${
              orderType === "limit"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Limit
          </button>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Qty</label>
          <Input
            type="text"
            inputMode="numeric"
            value={quantityInput}
            onChange={(e) => handleQuantityChange(e.target.value)}
            placeholder="Shares"
            className={`h-6 text-xs ${!isValidQuantity ? "border-red-300" : ""}`}
          />
        </div>

        {/* Limit Price Input - always reserve space */}
        <div style={{ minHeight: '38px' }}>
          {orderType === "limit" && (
            <>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Price</label>
              <Input
                type="number"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="$"
                className="h-6 text-xs"
              />
            </>
          )}
        </div>

        {/* Estimated Cost - always reserve space */}
        <div className="col-span-2" style={{ minHeight: '14px' }}>
          {estimatedCost !== null && (
            <div className="text-[10px] text-muted-foreground">
              Est: ${estimatedCost.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="flex gap-1.5 mt-1.5">
        <Button
          onClick={() => handleTrade("buy")}
          disabled={!canTrade}
          className={`flex-1 h-6 text-[10px] ${
            canTrade
              ? "bg-green-600 hover:bg-green-700"
              : "bg-green-600/50 cursor-not-allowed"
          }`}
        >
          {loading ? "..." : "Buy"}
        </Button>
        <Button
          onClick={() => handleTrade("sell")}
          disabled={!canTrade}
          className={`flex-1 h-6 text-[10px] ${
            canTrade
              ? "bg-red-600 hover:bg-red-700"
              : "bg-red-600/50 cursor-not-allowed"
          }`}
        >
          {loading ? "..." : "Sell"}
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded bg-red-50 p-1.5 text-[10px] text-red-600 mt-1.5">{error}</div>
      )}
      {success && (
        <div className="rounded bg-green-50 p-1.5 text-[10px] text-green-600 mt-1.5">{success}</div>
      )}
    </Card>
  );
}
