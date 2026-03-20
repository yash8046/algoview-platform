import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OHLCV, generateRuleBasedSignal, predictNextPrice, type TradeSignal } from '@/lib/technicalIndicators';

export interface SentimentData {
  news: { score: number; label: string; topHeadlines: string[] };
  social: { score: number; label: string; buzz: string };
  technical: { score: number; label: string };
  finalScore: number;
  manipulation_warning: string | null;
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
  timestamp: number;
}

const fallbackSentiment: SentimentData = {
  news: { score: 0, label: 'Neutral', topHeadlines: ['AI unavailable'] },
  social: { score: 0, label: 'Neutral', buzz: 'low' },
  technical: { score: 0, label: 'Neutral' },
  finalScore: 0,
  manipulation_warning: null,
};

export function useAIAnalysis() {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (candles: OHLCV[], pair: string, timeframe: string) => {
    if (candles.length < 50) {
      setError('Need at least 50 candles for analysis');
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

      setAnalysis({
        ruleBasedSignal: ruleSignal,
        aiSignal: data.aiSignal,
        ensembleSignal: data.ensembleSignal,
        sentiment: data.sentiment || fallbackSentiment,
        positiveFactors: data.positiveFactors || [],
        negativeFactors: data.negativeFactors || [],
        prediction,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      console.error('AI analysis error:', e);
      const ruleSignal = generateRuleBasedSignal(candles);
      const prediction = predictNextPrice(candles);
      setAnalysis({
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
      });
      setError('AI unavailable, showing rule-based analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  return { analysis, loading, error, analyze };
}
