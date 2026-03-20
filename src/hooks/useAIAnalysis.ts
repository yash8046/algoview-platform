import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OHLCV, generateRuleBasedSignal, predictNextPrice, type TradeSignal } from '@/lib/technicalIndicators';

export interface AIAnalysisResult {
  ruleBasedSignal: TradeSignal;
  aiSignal: {
    signal: 'buy' | 'sell' | 'hold';
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
    confidence: number;
    method: string;
    reasoning: string;
    factors: string[];
  };
  prediction: {
    predicted: number;
    direction: 'up' | 'down' | 'neutral';
    strength: number;
  };
  timestamp: number;
}

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
      // Step 1: Compute indicators & rule-based signal locally
      const ruleSignal = generateRuleBasedSignal(candles);
      const prediction = predictNextPrice(candles);

      // Step 2: Send to AI for enhanced analysis
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
        prediction,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      console.error('AI analysis error:', e);
      // Fallback to rule-based only
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
          confidence: ruleSignal.confidence,
          method: 'rule_only_fallback',
          reasoning: ruleSignal.reasons.join('. '),
          factors: ruleSignal.reasons,
        },
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
