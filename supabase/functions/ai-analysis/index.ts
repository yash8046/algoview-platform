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

    const systemPrompt = `You are an expert crypto trading analyst AI. You analyze technical indicators and generate trading signals.
You MUST respond with ONLY valid JSON, no markdown, no code blocks, no explanation outside the JSON.

Response format:
{
  "signal": "buy" | "sell" | "hold",
  "confidence": 0.0 to 1.0,
  "reasoning": "Detailed analysis in 2-3 sentences",
  "predictedMove": "up" | "down" | "sideways",
  "riskLevel": "low" | "medium" | "high",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "targetPrice": number or null,
  "stopLoss": number or null
}`;

    const userPrompt = `Analyze ${pair} on ${timeframe} timeframe.

Current Technical Indicators:
- Price: $${indicators.price}
- RSI(14): ${indicators.rsi?.toFixed(2)}
- MACD: ${indicators.macd?.toFixed(4)}, Signal: ${indicators.macdSignal?.toFixed(4)}
- SMA(20): $${indicators.sma20?.toFixed(2)}, SMA(50): $${indicators.sma50?.toFixed(2)}
- EMA(12): $${indicators.ema12?.toFixed(2)}, EMA(26): $${indicators.ema26?.toFixed(2)}
- Bollinger Bands: Upper=$${indicators.bbUpper?.toFixed(2)}, Middle=$${indicators.bbMiddle?.toFixed(2)}, Lower=$${indicators.bbLower?.toFixed(2)}
- ATR(14): $${indicators.atr?.toFixed(4)}
- Volatility(20): ${indicators.volatility?.toFixed(4)}

Rule-based system signal: ${ruleSignal.signal} (confidence: ${(ruleSignal.confidence * 100).toFixed(0)}%)
Rule-based reasons: ${ruleSignal.reasons.join('; ')}

Provide your independent AI analysis as JSON.`;

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

    // Parse AI response (strip markdown code blocks if present)
    let aiAnalysis;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiAnalysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      aiAnalysis = {
        signal: ruleSignal.signal,
        confidence: ruleSignal.confidence,
        reasoning: "AI analysis unavailable, using rule-based signal.",
        predictedMove: ruleSignal.signal === 'buy' ? 'up' : ruleSignal.signal === 'sell' ? 'down' : 'sideways',
        riskLevel: 'medium',
        keyFactors: ruleSignal.reasons.slice(0, 3),
        targetPrice: null,
        stopLoss: null,
      };
    }

    // Ensemble: combine rule-based and AI signals
    const ensembleSignal = computeEnsemble(ruleSignal, aiAnalysis);

    return new Response(JSON.stringify({
      ruleBasedSignal: ruleSignal,
      aiSignal: aiAnalysis,
      ensembleSignal,
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

function computeEnsemble(
  rule: { signal: string; confidence: number; reasons: string[] },
  ai: { signal: string; confidence: number; reasoning: string; keyFactors?: string[] }
) {
  const ruleWeight = 0.4;
  const aiWeight = 0.6;

  // If both agree, boost confidence
  if (rule.signal === ai.signal) {
    return {
      signal: rule.signal,
      confidence: Math.min(0.97, rule.confidence * ruleWeight + ai.confidence * aiWeight + 0.1),
      method: 'consensus',
      reasoning: ai.reasoning,
      factors: [...(ai.keyFactors || []), ...rule.reasons.slice(0, 2)],
    };
  }

  // Disagreement: use the one with higher weighted confidence
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
