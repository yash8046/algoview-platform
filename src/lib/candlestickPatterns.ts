import type { SeriesMarker, Time } from 'lightweight-charts';

interface Candle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function detectCandlestickPatterns(candles: Candle[]): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  if (candles.length < 3) return markers;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) continue;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Doji
    if (body / range < 0.1 && range > 0) {
      markers.push({
        time: c.time as Time,
        position: 'aboveBar',
        color: '#f59e0b',
        shape: 'circle',
        text: 'Doji',
      });
    }

    // Hammer (bullish)
    if (lowerWick > body * 2.5 && upperWick < body * 0.3 && c.close > c.open && body > 0) {
      markers.push({
        time: c.time as Time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'Hammer',
      });
    }

    // Shooting Star (bearish)
    if (upperWick > body * 2.5 && lowerWick < body * 0.3 && c.close < c.open && body > 0) {
      markers.push({
        time: c.time as Time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'Shoot★',
      });
    }

    // Bullish Engulfing
    if (
      prev.close < prev.open &&
      c.close > c.open &&
      c.open <= prev.close &&
      c.close >= prev.open
    ) {
      markers.push({
        time: c.time as Time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'BullEng',
      });
    }

    // Bearish Engulfing
    if (
      prev.close > prev.open &&
      c.close < c.open &&
      c.open >= prev.close &&
      c.close <= prev.open
    ) {
      markers.push({
        time: c.time as Time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'BearEng',
      });
    }

    // Morning Star (3-candle bullish reversal)
    if (i >= 2) {
      const pp = candles[i - 2];
      const mid = candles[i - 1];
      const midBody = Math.abs(mid.close - mid.open);
      const ppBody = Math.abs(pp.close - pp.open);
      if (
        pp.close < pp.open && ppBody > 0 &&
        midBody < ppBody * 0.3 &&
        c.close > c.open &&
        c.close > (pp.open + pp.close) / 2
      ) {
        markers.push({
          time: c.time as Time,
          position: 'belowBar',
          color: '#06b6d4',
          shape: 'arrowUp',
          text: 'Morning★',
        });
      }
    }

    // Evening Star (3-candle bearish reversal)
    if (i >= 2) {
      const pp = candles[i - 2];
      const mid = candles[i - 1];
      const midBody = Math.abs(mid.close - mid.open);
      const ppBody = Math.abs(pp.close - pp.open);
      if (
        pp.close > pp.open && ppBody > 0 &&
        midBody < ppBody * 0.3 &&
        c.close < c.open &&
        c.close < (pp.open + pp.close) / 2
      ) {
        markers.push({
          time: c.time as Time,
          position: 'aboveBar',
          color: '#f97316',
          shape: 'arrowDown',
          text: 'Evening★',
        });
      }
    }
  }

  return markers;
}
