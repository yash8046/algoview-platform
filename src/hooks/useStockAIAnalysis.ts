import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchYahooFinanceData, type YahooCandle } from '@/lib/yahooFinance';
import { type OHLCV, generateRuleBasedSignal, predictNextPrice } from '@/lib/technicalIndicators';
import { supabase } from '@/integrations/supabase/client';

export interface StockAIResult {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  predictedMove: 'up' | 'down' | 'sideways';
  riskLevel: 'low' | 'medium' | 'high';
  keyFactors: string[];
  targetPrice: number | null;
  stopLoss: number | null;
  prediction: { predicted: number; direction: 'up' | 'down' | 'neutral'; strength: number };
  indicators: {
    rsi: number; macd: number; sma20: number; sma50: number;
    ema12: number; ema26: number; bbUpper: number; bbLower: number;
    atr: number; price: number; adx: number; vwap: number;
  };
  regime: { regime: string; adx: number; trendStrength: number; volatilityLevel: string };
  riskMetrics: {
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    positionSizePct: number;
    riskRewardRatio: number;
  };
  timestamp: number;
}

export function useStockAIAnalysis(symbol: string, timeframe: string, autoRefreshMs = 30000) {
  const [result, setResult] = useState<StockAIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSymbol = useRef('');

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch candle data from Yahoo Finance
      const data = await fetchYahooFinanceData(symbol, timeframe);
      if (!data.candles || data.candles.length < 50) {
        setError('Insufficient candle data');
        setLoading(false);
        return;
      }

      const candles: OHLCV[] = data.candles.map(c => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      }));

      const ruleSignal = generateRuleBasedSignal(candles);
      const prediction = predictNextPrice(candles);

      // Call AI edge function
      const { data: aiData, error: fnError } = await supabase.functions.invoke('ai-analysis', {
        body: {
          indicators: ruleSignal.indicators,
          pair: `${symbol}.NS`,
          timeframe,
          ruleSignal: {
            signal: ruleSignal.signal,
            confidence: ruleSignal.confidence,
            reasons: ruleSignal.reasons,
          },
        },
      });

      if (fnError) throw fnError;

      const ensemble = aiData.ensembleSignal;
      const ai = aiData.aiSignal;

      setResult({
        signal: ensemble.signal as 'buy' | 'sell' | 'hold',
        confidence: ensemble.confidence,
        reasoning: ensemble.reasoning,
        predictedMove: ai.predictedMove,
        riskLevel: ai.riskLevel,
        keyFactors: ensemble.factors || [],
        targetPrice: ai.targetPrice,
        stopLoss: ai.stopLoss,
        prediction,
        indicators: ruleSignal.indicators,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      console.error(`Stock AI analysis error (${symbol}):`, e);

      // Fallback to rule-based
      try {
        const data = await fetchYahooFinanceData(symbol, timeframe);
        const candles: OHLCV[] = data.candles.map(c => ({
          time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));
        const ruleSignal = generateRuleBasedSignal(candles);
        const prediction = predictNextPrice(candles);

        setResult({
          signal: ruleSignal.signal,
          confidence: ruleSignal.confidence,
          reasoning: ruleSignal.reasons.join('. '),
          predictedMove: prediction.direction === 'up' ? 'up' : prediction.direction === 'down' ? 'down' : 'sideways',
          riskLevel: 'medium',
          keyFactors: ruleSignal.reasons,
          targetPrice: null,
          stopLoss: null,
          prediction,
          indicators: ruleSignal.indicators,
          timestamp: Date.now(),
        });
        setError('AI unavailable, using technical analysis');
      } catch {
        setError('Failed to analyze stock data');
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  // Auto analyze on symbol/timeframe change
  useEffect(() => {
    if (symbol !== lastSymbol.current) {
      lastSymbol.current = symbol;
      analyze();
    }
  }, [symbol, timeframe, analyze]);

  // Auto refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(analyze, autoRefreshMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [analyze, autoRefreshMs]);

  return { result, loading, error, refresh: analyze };
}
