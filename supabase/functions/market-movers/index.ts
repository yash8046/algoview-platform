import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Large pool of popular NSE stocks across sectors
const NSE_POOL = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN","BHARTIARTL",
  "ITC","KOTAKBANK","LT","AXISBANK","BAJFINANCE","MARUTI","HCLTECH","TATAMOTORS",
  "SUNPHARMA","TITAN","ADANIENT","NTPC","POWERGRID","ULTRACEMCO","ASIANPAINT",
  "NESTLEIND","WIPRO","JSWSTEEL","TATASTEEL","TECHM","ONGC","COALINDIA","BAJAJFINSV",
  "GRASIM","CIPLA","DRREDDY","DIVISLAB","BPCL","HEROMOTOCO","EICHERMOT","APOLLOHOSP",
  "TATAPOWER","ADANIGREEN","ADANIPORTS","ZOMATO","PAYTM","JIOFIN","IRFC","NHPC",
  "SUZLON","POLYCAB","DIXON","PERSISTENT","HAL","BEL","IRCTC","SBILIFE","HDFCLIFE",
  "PIDILITIND","SIEMENS","GODREJCP","DABUR","INDIGO","TRENT","VEDL","HINDALCO",
  "BANKBARODA","PNB","CANBK","IOC","GAIL"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { count = 10 } = await req.json().catch(() => ({}));

    // Fetch quotes for the pool using Yahoo Finance v7 quote endpoint (batch)
    const symbols = NSE_POOL.map(s => `${s}.NS`).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      // Fallback: try v6 endpoint
      const v6Url = `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${symbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent`;
      const v6Resp = await fetch(v6Url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!v6Resp.ok) {
        throw new Error(`Yahoo API error: ${response.status}`);
      }
      const v6Data = await v6Resp.json();
      const quotes = v6Data?.quoteResponse?.result || [];
      return buildResponse(quotes, count);
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    return buildResponse(quotes, count);
  } catch (e) {
    console.error("market-movers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", gainers: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildResponse(quotes: any[], count: number) {
  const valid = quotes
    .filter((q: any) => q.regularMarketPrice && q.regularMarketChangePercent !== undefined)
    .map((q: any) => ({
      symbol: (q.symbol || "").replace(".NS", ""),
      name: q.shortName || q.longName || (q.symbol || "").replace(".NS", ""),
      price: q.regularMarketPrice,
      change: q.regularMarketChangePercent,
    }));

  // Sort by % change descending → top gainers
  valid.sort((a: any, b: any) => b.change - a.change);

  return new Response(
    JSON.stringify({ gainers: valid.slice(0, count) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
