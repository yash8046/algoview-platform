import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { type OHLCV, generateRuleBasedSignal, predictNextPrice } from '@/lib/technicalIndicators';
import { supabase } from '@/integrations/supabase/client';
import type { SentimentData, PriceRange, TimeHorizon } from './useAIAnalysis';

export interface StockAIResult {
  signal: 'buy' | 'sell' | 'hold';
  detailedSignal: string;
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
  sentiment: SentimentData;
  positiveFactors: string[];
  negativeFactors: string[];
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

// Cache: reuse results within 5 minutes for same symbol+timeframe
const cache = new Map<string, { result: StockAIResult; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function useStockAIAnalysis(symbol: string, timeframe: string) {
  const [result, setResult] = useState<StockAIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear result when symbol changes
  const lastSymbol = useRef(symbol);
  useEffect(() => {
    if (symbol !== lastSymbol.current) {
      lastSymbol.current = symbol;
      // Check cache for new symbol
      const cacheKey = `${symbol}-${timeframe}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        setResult(cached.result);
        setError(null);
      } else {
        setResult(null);
        setError(null);
      }
    }
  }, [symbol, timeframe]);

  const analyze = useCallback(async () => {
    // Check cache first
    const cacheKey = `${symbol}-${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      setResult(cached.result);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      const newResult: StockAIResult = {
        signal: ensemble.signal as 'buy' | 'sell' | 'hold',
        detailedSignal: ensemble.detailedSignal || ensemble.signal,
        confidence: ensemble.confidence,
        reasoning: ensemble.reasoning,
        predictedMove: ai.predictedMove,
        riskLevel: ai.riskLevel,
        keyFactors: ensemble.factors || [],
        targetPrice: ai.targetPrice,
        stopLoss: ai.stopLoss,
        prediction,
        indicators: ruleSignal.indicators,
        regime: ruleSignal.regime,
        riskMetrics: ruleSignal.riskMetrics,
        sentiment: aiData.sentiment || fallbackSentiment,
        positiveFactors: aiData.positiveFactors || [],
        negativeFactors: aiData.negativeFactors || [],
        timestamp: Date.now(),
      };

      cache.set(cacheKey, { result: newResult, expiry: Date.now() + CACHE_TTL });
      setResult(newResult);
    } catch (e: any) {
      console.error(`Stock AI analysis error (${symbol}):`, e);
      try {
        const data = await fetchYahooFinanceData(symbol, timeframe);
        const candles: OHLCV[] = data.candles.map(c => ({
          time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));
        const ruleSignal = generateRuleBasedSignal(candles);
        const prediction = predictNextPrice(candles);

        const fallbackResult: StockAIResult = {
          signal: ruleSignal.signal,
          detailedSignal: ruleSignal.signal,
          confidence: ruleSignal.confidence,
          reasoning: ruleSignal.reasons.join('. '),
          predictedMove: prediction.direction === 'up' ? 'up' : prediction.direction === 'down' ? 'down' : 'sideways',
          riskLevel: 'medium',
          keyFactors: ruleSignal.reasons,
          targetPrice: null,
          stopLoss: null,
          prediction,
          indicators: ruleSignal.indicators,
          regime: ruleSignal.regime,
          riskMetrics: ruleSignal.riskMetrics,
          sentiment: fallbackSentiment,
          positiveFactors: [],
          negativeFactors: [],
          timestamp: Date.now(),
        };

        cache.set(cacheKey, { result: fallbackResult, expiry: Date.now() + CACHE_TTL });
        setResult(fallbackResult);
        setError('AI unavailable, using technical analysis');
      } catch {
        setError('Failed to analyze stock data');
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  return { result, loading, error, refresh: analyze };
}
