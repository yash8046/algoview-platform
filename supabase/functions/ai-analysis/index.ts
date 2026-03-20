import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicators, pair, timeframe, ruleSignal } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert quantitative trading analyst AI that combines technical analysis with news/social sentiment analysis.

You MUST respond with ONLY valid JSON, no markdown, no code blocks.

Analyze the asset using:
1. Technical indicators provided
2. Your knowledge of recent market news, sentiment, and events for this asset
3. Social media sentiment patterns

Apply this weighting:
- News Sentiment: 0.5 weight
- Social/Market Sentiment: 0.3 weight  
- Technical Indicators: 0.2 weight

Decision thresholds on final weighted score (-1 to +1):
- > +0.25 → STRONG BUY
- +0.1 to +0.25 → BUY
- -0.1 to +0.1 → HOLD
- -0.25 to -0.1 → SELL
- < -0.25 → STRONG SELL

Response format:
{
  "signal": "strong_buy" | "buy" | "sell" | "strong_sell" | "hold",
  "confidence": 0.0 to 1.0,
  "reasoning": "2-3 sentence analysis",
  "predictedMove": "up" | "down" | "sideways",
  "riskLevel": "low" | "medium" | "high",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "targetPrice": number or null,
  "stopLoss": number or null,
  "sentiment": {
    "news": { "score": -1.0 to 1.0, "label": "Bullish" | "Bearish" | "Neutral", "topHeadlines": ["headline1", "headline2", "headline3"] },
    "social": { "score": -1.0 to 1.0, "label": "Bullish" | "Bearish" | "Neutral", "buzz": "high" | "medium" | "low" },
    "technical": { "score": -1.0 to 1.0, "label": "Bullish" | "Bearish" | "Neutral" },
    "finalScore": -1.0 to 1.0,
    "manipulation_warning": null or "string describing suspected manipulation/hype"
  },
  "positiveFactors": ["top positive factor 1", "top positive factor 2", "top positive factor 3"],
  "negativeFactors": ["top negative factor 1", "top negative factor 2", "top negative factor 3"]
}`;

    const userPrompt = `Analyze ${pair} on ${timeframe} timeframe for SHORT-TERM (intraday / 1-3 day) price movement.

Current Technical Indicators:
- Price: $${indicators.price}
- RSI(14): ${indicators.rsi?.toFixed(2)}
- MACD: ${indicators.macd?.toFixed(4)}, Signal: ${indicators.macdSignal?.toFixed(4)}
- SMA(20): $${indicators.sma20?.toFixed(2)}, SMA(50): $${indicators.sma50?.toFixed(2)}
- EMA(12): $${indicators.ema12?.toFixed(2)}, EMA(26): $${indicators.ema26?.toFixed(2)}
- Bollinger Bands: Upper=$${indicators.bbUpper?.toFixed(2)}, Middle=$${indicators.bbMiddle?.toFixed(2)}, Lower=$${indicators.bbLower?.toFixed(2)}
- ATR(14): $${indicators.atr?.toFixed(4)}
- Volatility(20): ${indicators.volatility?.toFixed(4)}
- ADX: ${indicators.adx?.toFixed(2) || 'N/A'}
- VWAP: $${indicators.vwap?.toFixed(2) || 'N/A'}

Rule-based system signal: ${ruleSignal.signal} (confidence: ${(ruleSignal.confidence * 100).toFixed(0)}%)
Rule-based reasons: ${ruleSignal.reasons.join('; ')}

Instructions:
1. Analyze recent news sentiment for ${pair} (what major headlines exist?)
2. Assess social media / market sentiment (is there hype, fear, or neutral?)
3. Evaluate technical indicators above
4. Combine with weighted scoring (news 0.5, social 0.3, technical 0.2)
5. Flag any suspected manipulation or hype signals
6. If you lack data for news/social, estimate conservatively and note it

Provide your analysis as JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let aiAnalysis;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiAnalysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      aiAnalysis = buildFallbackAnalysis(ruleSignal);
    }

    // Ensure sentiment object exists
    if (!aiAnalysis.sentiment) {
      aiAnalysis.sentiment = buildFallbackSentiment(ruleSignal);
    }

    // Normalize signal to simple buy/sell/hold for ensemble
    const normalizedSignal = normalizeSignal(aiAnalysis.signal);

    const ensembleSignal = computeEnsemble(ruleSignal, { ...aiAnalysis, signal: normalizedSignal });

    return new Response(JSON.stringify({
      ruleBasedSignal: ruleSignal,
      aiSignal: aiAnalysis,
      ensembleSignal: {
        ...ensembleSignal,
        // Use the detailed signal tier from AI
        detailedSignal: aiAnalysis.signal,
      },
      sentiment: aiAnalysis.sentiment,
      positiveFactors: aiAnalysis.positiveFactors || [],
      negativeFactors: aiAnalysis.negativeFactors || [],
      timestamp: Date.now(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeSignal(signal: string): string {
  if (signal === 'strong_buy') return 'buy';
  if (signal === 'strong_sell') return 'sell';
  return signal;
}

function buildFallbackSentiment(ruleSignal: { signal: string; confidence: number }) {
  const techScore = ruleSignal.signal === 'buy' ? 0.3 : ruleSignal.signal === 'sell' ? -0.3 : 0;
  return {
    news: { score: 0, label: 'Neutral', topHeadlines: ['Insufficient data for news sentiment'] },
    social: { score: 0, label: 'Neutral', buzz: 'low' },
    technical: { score: techScore, label: techScore > 0 ? 'Bullish' : techScore < 0 ? 'Bearish' : 'Neutral' },
    finalScore: techScore * 0.2,
    manipulation_warning: null,
  };
}

function buildFallbackAnalysis(ruleSignal: { signal: string; confidence: number; reasons: string[] }) {
  return {
    signal: ruleSignal.signal,
    confidence: ruleSignal.confidence,
    reasoning: "AI analysis unavailable, using rule-based signal.",
    predictedMove: ruleSignal.signal === 'buy' ? 'up' : ruleSignal.signal === 'sell' ? 'down' : 'sideways',
    riskLevel: 'medium',
    keyFactors: ruleSignal.reasons.slice(0, 3),
    targetPrice: null,
    stopLoss: null,
    sentiment: buildFallbackSentiment(ruleSignal),
    positiveFactors: ruleSignal.signal === 'buy' ? ruleSignal.reasons.slice(0, 3) : [],
    negativeFactors: ruleSignal.signal === 'sell' ? ruleSignal.reasons.slice(0, 3) : [],
  };
}

function computeEnsemble(
  rule: { signal: string; confidence: number; reasons: string[] },
  ai: { signal: string; confidence: number; reasoning: string; keyFactors?: string[] }
) {
  const ruleWeight = 0.4;
  const aiWeight = 0.6;

  if (rule.signal === ai.signal) {
    return {
      signal: rule.signal,
      confidence: Math.min(0.97, rule.confidence * ruleWeight + ai.confidence * aiWeight + 0.1),
      method: 'consensus',
      reasoning: ai.reasoning,
      factors: [...(ai.keyFactors || []), ...rule.reasons.slice(0, 2)],
    };
  }

  const ruleScore = rule.confidence * ruleWeight;
  const aiScore = ai.confidence * aiWeight;

  if (ruleScore > aiScore) {
    return {
      signal: rule.signal,
      confidence: Math.max(0.3, rule.confidence - 0.15),
      method: 'rule_override',
      reasoning: `Rule-based analysis overrides AI. ${rule.reasons[0]}`,
      factors: rule.reasons,
    };
  }

  return {
    signal: ai.signal,
    confidence: Math.max(0.3, ai.confidence - 0.15),
    method: 'ai_override',
    reasoning: ai.reasoning,
    factors: ai.keyFactors || [],
  };
}
