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
  "NESTLEIND","WIPRO","JSWSTEEL","TATASTEEL","TECHM","ONGC","COALINDIA",
  "CIPLA","DRREDDY","BPCL","HEROMOTOCO","APOLLOHOSP",
  "TATAPOWER","ADANIGREEN","ADANIPORTS","ZOMATO","PAYTM","JIOFIN","IRFC","NHPC",
  "SUZLON","POLYCAB","DIXON","PERSISTENT","HAL","BEL","IRCTC",
  "PIDILITIND","SIEMENS","DABUR","INDIGO","TRENT","VEDL","HINDALCO",
  "BANKBARODA","PNB","IOC","GAIL"
];

const NAMES: Record<string, string> = {
  RELIANCE:"Reliance",TCS:"TCS",HDFCBANK:"HDFC Bank",INFY:"Infosys",ICICIBANK:"ICICI Bank",
  HINDUNILVR:"Hindustan Unilever",SBIN:"SBI",BHARTIARTL:"Bharti Airtel",ITC:"ITC",
  KOTAKBANK:"Kotak Bank",LT:"L&T",AXISBANK:"Axis Bank",BAJFINANCE:"Bajaj Finance",
  MARUTI:"Maruti Suzuki",HCLTECH:"HCL Tech",TATAMOTORS:"Tata Motors",SUNPHARMA:"Sun Pharma",
  TITAN:"Titan",ADANIENT:"Adani Ent",NTPC:"NTPC",POWERGRID:"Power Grid",
  ULTRACEMCO:"UltraTech Cement",ASIANPAINT:"Asian Paints",NESTLEIND:"Nestle India",
  WIPRO:"Wipro",JSWSTEEL:"JSW Steel",TATASTEEL:"Tata Steel",TECHM:"Tech Mahindra",
  ONGC:"ONGC",COALINDIA:"Coal India",CIPLA:"Cipla",DRREDDY:"Dr Reddy's",
  BPCL:"BPCL",HEROMOTOCO:"Hero MotoCorp",APOLLOHOSP:"Apollo Hospitals",
  TATAPOWER:"Tata Power",ADANIGREEN:"Adani Green",ADANIPORTS:"Adani Ports",
  ZOMATO:"Zomato",PAYTM:"Paytm",JIOFIN:"Jio Financial",IRFC:"IRFC",NHPC:"NHPC",
  SUZLON:"Suzlon Energy",POLYCAB:"Polycab",DIXON:"Dixon Tech",PERSISTENT:"Persistent Sys",
  HAL:"HAL",BEL:"BEL",IRCTC:"IRCTC",PIDILITIND:"Pidilite",SIEMENS:"Siemens",
  DABUR:"Dabur",INDIGO:"IndiGo",TRENT:"Trent",VEDL:"Vedanta",HINDALCO:"Hindalco",
  BANKBARODA:"Bank of Baroda",PNB:"PNB",IOC:"IOC",GAIL:"GAIL"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { count = 10 } = await req.json().catch(() => ({}));

    // Use v8 chart API in batch — fetch 1d data for each symbol via spark
    const symbols = NSE_POOL.map(s => `${s}.NS`).join(",");
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols}&range=1d&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      // Fallback: fetch individual charts for a smaller set
      console.log("Spark API failed, using individual chart fallback");
      const results = await fetchIndividual(NSE_POOL.slice(0, 20));
      results.sort((a: any, b: any) => b.change - a.change);
      const losers = [...results].reverse().filter((r: any) => r.change < 0).slice(0, count);
      return new Response(
        JSON.stringify({ gainers: results.slice(0, count), losers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const results: any[] = [];

    for (const sym of NSE_POOL) {
      const yahooSym = `${sym}.NS`;
      const sparkData = data?.spark?.result?.find((r: any) => r.symbol === yahooSym);
      if (!sparkData?.response?.[0]) continue;

      const meta = sparkData.response[0].meta;
      const price = meta?.regularMarketPrice;
      const prevClose = meta?.previousClose || meta?.chartPreviousClose;

      if (price && prevClose && prevClose > 0) {
        const change = ((price - prevClose) / prevClose) * 100;
        results.push({
          symbol: sym,
          name: NAMES[sym] || sym,
          price,
          change: Math.round(change * 100) / 100,
        });
      }
    }

    results.sort((a, b) => b.change - a.change);

    // Top gainers and losers
    const losers = [...results].reverse().filter(r => r.change < 0).slice(0, count);

    return new Response(
      JSON.stringify({ gainers: results.slice(0, count), losers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("market-movers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", gainers: [], losers: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchIndividual(symbols: string[]) {
  const results: any[] = [];
  const fetches = symbols.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=1d`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return;
      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose || meta.chartPreviousClose;
      if (price && prevClose && prevClose > 0) {
        results.push({
          symbol: sym,
          name: NAMES[sym] || sym,
          price,
          change: Math.round(((price - prevClose) / prevClose) * 10000) / 100,
        });
      }
    } catch {}
  });
  await Promise.all(fetches);
  return results;
}
