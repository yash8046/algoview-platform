import { supabase } from '@/integrations/supabase/client';

export interface YahooCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooResponse {
  symbol: string;
  currency: string;
  exchangeName: string;
  regularMarketPrice: number;
  previousClose: number;
  candles: YahooCandle[];
}

const INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
  '1H': { interval: '1h', range: '1mo' },
  '4H': { interval: '1h', range: '3mo' },
  '1D': { interval: '1d', range: '6mo' },
  '1W': { interval: '1wk', range: '2y' },
};

const BACKTEST_INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '60d' },
  '15m': { interval: '15m', range: '60d' },
  '1H': { interval: '1h', range: '2y' },
  '4H': { interval: '1h', range: '2y' },
  '1D': { interval: '1d', range: '5y' },
  '1W': { interval: '1wk', range: '10y' },
};

// In-memory cache for fast reloads
const dataCache = new Map<string, { data: YahooResponse; ts: number }>();
const CACHE_TTL: Record<string, number> = {
  '1m': 30_000,
  '5m': 60_000,
  '15m': 2 * 60_000,
  '1H': 5 * 60_000,
  '4H': 10 * 60_000,
  '1D': 15 * 60_000,
  '1W': 30 * 60_000,
};

export async function fetchYahooFinanceData(
  symbol: string,
  timeframe: string = '1D',
  backtest: boolean = false
): Promise<YahooResponse> {
  const cacheKey = `${symbol}-${timeframe}-${backtest}`;
  const cached = dataCache.get(cacheKey);
  const ttl = CACHE_TTL[timeframe] || 60_000;

  if (cached && Date.now() - cached.ts < ttl) {
    return cached.data;
  }

  const map = backtest ? BACKTEST_INTERVAL_MAP : INTERVAL_MAP;
  const params = map[timeframe] || map['1D'];

  const { data, error } = await supabase.functions.invoke('yahoo-finance', {
    body: { symbol, interval: params.interval, range: params.range },
  });

  if (error) throw new Error(error.message || 'Failed to fetch market data');
  if (data.error) throw new Error(data.error);

  const result = data as YahooResponse;
  dataCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}
