import { NextRequest, NextResponse } from "next/server";
import { getAggregates } from "@/lib/polygon";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get("ticker");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const timespan = searchParams.get("timespan") as "day" | "hour" | "minute";

  if (!ticker || !from || !to) {
    return NextResponse.json(
      { error: "Missing required parameters: ticker, from, to" },
      { status: 400 }
    );
  }

  try {
    const data = await getAggregates(ticker, from, to, timespan || "day");
    return NextResponse.json({ ticker, data });
  } catch (error) {
    console.error("Market data fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
