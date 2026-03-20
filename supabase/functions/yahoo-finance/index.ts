import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval, range } = await req.json();

    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Yahoo Finance v8 chart API
    // Map special index symbols
    const INDEX_MAP: Record<string, string> = {
      'NIFTY 50': '^NSEI',
      'SENSEX': '^BSESN',
      'BANKNIFTY': '^NSEBANK',
    };
    const yahooSymbol = INDEX_MAP[symbol] || (symbol.includes(".") || symbol.startsWith("^") ? symbol : `${symbol}.NS`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval || "1d"}&range=${range || "6mo"}&includePrePost=false`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Yahoo Finance error:", response.status, text);
      // Try parsing the error for more context
      let errorMsg = `Symbol ${yahooSymbol} not found or unavailable`;
      try {
        const errData = JSON.parse(text);
        errorMsg = errData?.chart?.error?.description || errorMsg;
      } catch {}
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return new Response(JSON.stringify({ error: "No data found for symbol" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    const candles = timestamps.map((ts: number, i: number) => ({
      time: ts,
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    })).filter((c: any) => c.open !== null && c.close !== null);

    const responseData = {
      symbol: meta.symbol,
      currency: meta.currency || "INR",
      exchangeName: meta.exchangeName,
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose,
      candles,
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Edge function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
