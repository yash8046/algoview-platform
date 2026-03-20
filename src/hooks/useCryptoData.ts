import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchKlines, connectKlineWebSocket, type BinanceCandle } from '@/lib/binanceApi';

export function useCryptoData(symbol: string, interval: string) {
  const [candles, setCandles] = useState<BinanceCandle[]>([]);
  const [livePrice, setLivePrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsCleanup = useRef<(() => void) | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchKlines(symbol, interval, 500);
      setCandles(data);
      if (data.length > 0) setLivePrice(data[data.length - 1].close);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (wsCleanup.current) wsCleanup.current();

    wsCleanup.current = connectKlineWebSocket(symbol, interval, {
      onCandle: (candle) => {
        setLivePrice(candle.close);
        setCandles((prev) => {
          if (prev.length === 0) return [candle];
          const last = prev[prev.length - 1];
          if (last.time === candle.time) {
            return [...prev.slice(0, -1), candle];
          }
          return [...prev, candle];
        });
      },
      onError: () => {
        console.warn('WebSocket error, will auto-reconnect');
      },
    });

    return () => {
      if (wsCleanup.current) wsCleanup.current();
    };
  }, [symbol, interval]);

  return { candles, livePrice, loading, error, reload: loadData };
}
