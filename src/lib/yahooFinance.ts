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

export async function fetchYahooFinanceData(
  symbol: string,
  timeframe: string = '1D'
): Promise<YahooResponse> {
  const params = INTERVAL_MAP[timeframe] || INTERVAL_MAP['1D'];

  const { data, error } = await supabase.functions.invoke('yahoo-finance', {
    body: { symbol, interval: params.interval, range: params.range },
  });

  if (error) throw new Error(error.message || 'Failed to fetch market data');
  if (data.error) throw new Error(data.error);
  return data as YahooResponse;
}
