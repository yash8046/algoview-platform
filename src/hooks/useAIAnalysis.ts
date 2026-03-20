import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OHLCV, generateRuleBasedSignal, predictNextPrice, type TradeSignal } from '@/lib/technicalIndicators';

export interface SentimentData {
  news: { score: number; label: string; topHeadlines: string[] };
  social: { score: number; label: string; buzz: string };
  technical: { score: number; label: string };
  finalScore: number;
  manipulation_warning: string | null;
}

export interface PriceRange {
  low: number;
  high: number;
  lowPct: number;
  highPct: number;
}

export interface TimeHorizon {
  minDays: number;
  maxDays: number;
  label: string;
  catalyst: string | null;
}

export interface AIAnalysisResult {
  ruleBasedSignal: TradeSignal;
  aiSignal: {
    signal: string;
    confidence: number;
    reasoning: string;
    predictedMove: 'up' | 'down' | 'sideways';
    riskLevel: 'low' | 'medium' | 'high';
    keyFactors: string[];
    targetPrice: number | null;
    stopLoss: number | null;
  };
  ensembleSignal: {
    signal: string;
    detailedSignal: string;
    confidence: number;
    method: string;
    reasoning: string;
    factors: string[];
  };
  sentiment: SentimentData;
  positiveFactors: string[];
  negativeFactors: string[];
  prediction: {
    predicted: number;
    direction: 'up' | 'down' | 'neutral';
    strength: number;
  };
  priceRange: PriceRange | null;
  timeHorizon: TimeHorizon | null;
  volatilityCategory: 'low' | 'medium' | 'high' | null;
  timestamp: number;
}

const fallbackSentiment: SentimentData = {
  news: { score: 0, label: 'Neutral', topHeadlines: ['AI unavailable'] },
  social: { score: 0, label: 'Neutral', buzz: 'low' },
  technical: { score: 0, label: 'Neutral' },
  finalScore: 0,
  manipulation_warning: null,
};

// Cache: reuse results within 5 minutes
const cache = new Map<string, { result: AIAnalysisResult; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function useAIAnalysis() {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (candles: OHLCV[], pair: string, timeframe: string) => {
    if (candles.length < 50) {
      setError('Need at least 50 candles for analysis');
      return;
    }

    // Check cache
    const cacheKey = `${pair}-${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      setAnalysis(cached.result);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ruleSignal = generateRuleBasedSignal(candles);
      const prediction = predictNextPrice(candles);

      const { data, error: fnError } = await supabase.functions.invoke('ai-analysis', {
        body: {
          indicators: ruleSignal.indicators,
          pair,
          timeframe,
          ruleSignal: {
            signal: ruleSignal.signal,
            confidence: ruleSignal.confidence,
            reasons: ruleSignal.reasons,
          },
        },
      });

      if (fnError) throw fnError;

      const result: AIAnalysisResult = {
        ruleBasedSignal: ruleSignal,
        aiSignal: data.aiSignal,
        ensembleSignal: data.ensembleSignal,
        sentiment: data.sentiment || fallbackSentiment,
        positiveFactors: data.positiveFactors || [],
        negativeFactors: data.negativeFactors || [],
        prediction,
        timestamp: Date.now(),
      };

      cache.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
      setAnalysis(result);
    } catch (e: any) {
      console.error('AI analysis error:', e);
      const ruleSignal = generateRuleBasedSignal(candles);
      const prediction = predictNextPrice(candles);
      const fallbackResult: AIAnalysisResult = {
        ruleBasedSignal: ruleSignal,
        aiSignal: {
          signal: ruleSignal.signal,
          confidence: ruleSignal.confidence,
          reasoning: 'AI unavailable — using technical analysis only.',
          predictedMove: prediction.direction === 'up' ? 'up' : prediction.direction === 'down' ? 'down' : 'sideways',
          riskLevel: 'medium',
          keyFactors: ruleSignal.reasons.slice(0, 3),
          targetPrice: null,
          stopLoss: null,
        },
        ensembleSignal: {
          signal: ruleSignal.signal,
          detailedSignal: ruleSignal.signal,
          confidence: ruleSignal.confidence,
          method: 'rule_only_fallback',
          reasoning: ruleSignal.reasons.join('. '),
          factors: ruleSignal.reasons,
        },
        sentiment: fallbackSentiment,
        positiveFactors: [],
        negativeFactors: [],
        prediction,
        timestamp: Date.now(),
      };
      cache.set(cacheKey, { result: fallbackResult, expiry: Date.now() + CACHE_TTL });
      setAnalysis(fallbackResult);
      setError('AI unavailable, showing rule-based analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  return { analysis, loading, error, analyze };
}
