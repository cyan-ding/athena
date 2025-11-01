import axios from "axios";

const POLYGON_BASE_URL = "https://api.polygon.io";

export interface OHLCVBar {
  timestamp: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PolygonAggregatesResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results: Array<{
    v: number; // volume
    vw: number; // volume weighted average price
    o: number; // open
    c: number; // close
    h: number; // high
    l: number; // low
    t: number; // timestamp
    n: number; // number of transactions
  }>;
  status: string;
  request_id: string;
  count: number;
}

/**
 * Fetch historical aggregates (bars) from Polygon.io
 * @param ticker - Stock ticker symbol (e.g., "NVDA")
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @param timespan - bar timespan: minute, hour, day, week, month, quarter, year
 * @param multiplier - size of timespan multiplier (e.g., 1 for 1 day, 5 for 5 minutes)
 */
export async function getAggregates(
  ticker: string,
  from: string,
  to: string,
  timespan: "minute" | "hour" | "day" | "week" | "month" = "day",
  multiplier: number = 1
): Promise<OHLCVBar[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error("POLYGON_API_KEY is not set");
  }

  const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`;

  try {
    const response = await axios.get<PolygonAggregatesResponse>(url, {
      params: {
        adjusted: true,
        sort: "asc",
        limit: 50000,
        apiKey: apiKey,
      },
    });

    // Accept both OK and DELAYED status (free tier has delayed data)
    if (response.data.status !== "OK" && response.data.status !== "DELAYED") {
      throw new Error(`Polygon API error: ${response.data.status}`);
    }

    if (!response.data.results || response.data.results.length === 0) {
      return [];
    }

    return response.data.results.map((bar) => ({
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Polygon API request failed: ${error.response?.data?.error || error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get current snapshot for a ticker
 */
export async function getSnapshot(ticker: string) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error("POLYGON_API_KEY is not set");
  }

  const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`;

  try {
    const response = await axios.get(url, {
      params: { apiKey },
    });

    return response.data.ticker;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Polygon snapshot failed: ${error.response?.data?.error || error.message}`
      );
    }
    throw error;
  }
}
