// Technical Indicators Library
// All calculations are pure functions operating on OHLCV candle data

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  sma20: number[];
  sma50: number[];
  ema12: number[];
  ema26: number[];
  rsi14: number[];
  macd: { macd: number; signal: number; histogram: number }[];
  bollingerBands: { upper: number; middle: number; lower: number }[];
  atr14: number[];
  priceReturns: number[];
  volatility20: number[];
}

// Simple Moving Average
export function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

// Exponential Moving Average
export function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes[0];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      ema = closes[0];
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(i < period - 1 ? NaN : ema);
  }
  return result;
}

// Relative Strength Index
export function calcRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [NaN];
  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period && i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 1; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
      continue;
    }
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// MACD (12, 26, 9)
export function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number }[] {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine: number[] = ema12.map((v, i) => v - ema26[i]);

  // Signal line (EMA 9 of MACD)
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalEma = calcEMA(validMacd, 9);

  const result: { macd: number; signal: number; histogram: number }[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      result.push({ macd: NaN, signal: NaN, histogram: NaN });
    } else {
      const sig = signalIdx < signalEma.length ? signalEma[signalIdx] : NaN;
      result.push({
        macd: macdLine[i],
        signal: sig,
        histogram: macdLine[i] - (isNaN(sig) ? 0 : sig),
      });
      signalIdx++;
    }
  }
  return result;
}

// Bollinger Bands (20, 2)
export function calcBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: number; middle: number; lower: number }[] {
  const sma = calcSMA(closes, period);
  return sma.map((mid, i) => {
    if (isNaN(mid)) return { upper: NaN, middle: NaN, lower: NaN };
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - mid) ** 2;
    }
    const sd = Math.sqrt(sumSq / period);
    return { upper: mid + stdDev * sd, middle: mid, lower: mid - stdDev * sd };
  });
}

// Average True Range
export function calcATR(candles: OHLCV[], period: number = 14): number[] {
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  return calcSMA(trs, period);
}

// Price returns (percentage change)
export function calcReturns(closes: number[]): number[] {
  return closes.map((c, i) => (i === 0 ? 0 : ((c - closes[i - 1]) / closes[i - 1]) * 100));
}

// Rolling volatility (std dev of returns)
export function calcVolatility(closes: number[], period: number = 20): number[] {
  const returns = calcReturns(closes);
  return returns.map((_, i) => {
    if (i < period) return NaN;
    const slice = returns.slice(i - period, i);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    return Math.sqrt(variance);
  });
}

// Compute all indicators for a candle dataset
export function computeAllIndicators(candles: OHLCV[]): IndicatorResult {
  const closes = candles.map(c => c.close);
  return {
    sma20: calcSMA(closes, 20),
    sma50: calcSMA(closes, 50),
    ema12: calcEMA(closes, 12),
    ema26: calcEMA(closes, 26),
    rsi14: calcRSI(closes, 14),
    macd: calcMACD(closes),
    bollingerBands: calcBollingerBands(closes),
    atr14: calcATR(candles),
    priceReturns: calcReturns(closes),
    volatility20: calcVolatility(closes),
  };
}

// Rule-based signal generation
export interface TradeSignal {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasons: string[];
  indicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
    bbUpper: number;
    bbLower: number;
    bbMiddle: number;
    atr: number;
    volatility: number;
    price: number;
  };
}

export function generateRuleBasedSignal(candles: OHLCV[]): TradeSignal {
  if (candles.length < 50) {
    return {
      signal: 'hold',
      confidence: 0,
      reasons: ['Insufficient data for analysis'],
      indicators: { rsi: 0, macd: 0, macdSignal: 0, sma20: 0, sma50: 0, ema12: 0, ema26: 0, bbUpper: 0, bbLower: 0, bbMiddle: 0, atr: 0, volatility: 0, price: 0 },
    };
  }

  const ind = computeAllIndicators(candles);
  const last = candles.length - 1;
  const price = candles[last].close;

  const rsi = ind.rsi14[last];
  const macdData = ind.macd[last];
  const sma20 = ind.sma20[last];
  const sma50 = ind.sma50[last];
  const ema12 = ind.ema12[last];
  const ema26 = ind.ema26[last];
  const bb = ind.bollingerBands[last];
  const atr = ind.atr14[last];
  const vol = ind.volatility20[last];

  const indicators = {
    rsi, macd: macdData.macd, macdSignal: macdData.signal,
    sma20, sma50, ema12, ema26,
    bbUpper: bb.upper, bbLower: bb.lower, bbMiddle: bb.middle,
    atr, volatility: vol, price,
  };

  let buyScore = 0;
  let sellScore = 0;
  const reasons: string[] = [];

  // RSI signals
  if (rsi < 30) { buyScore += 2; reasons.push(`RSI oversold at ${rsi.toFixed(1)}`); }
  else if (rsi < 40) { buyScore += 1; reasons.push(`RSI approaching oversold (${rsi.toFixed(1)})`); }
  else if (rsi > 70) { sellScore += 2; reasons.push(`RSI overbought at ${rsi.toFixed(1)}`); }
  else if (rsi > 60) { sellScore += 1; reasons.push(`RSI approaching overbought (${rsi.toFixed(1)})`); }

  // EMA crossover
  if (ema12 > ema26 && ind.ema12[last - 1] <= ind.ema26[last - 1]) {
    buyScore += 3; reasons.push('Bullish EMA 12/26 crossover');
  } else if (ema12 < ema26 && ind.ema12[last - 1] >= ind.ema26[last - 1]) {
    sellScore += 3; reasons.push('Bearish EMA 12/26 crossover');
  } else if (ema12 > ema26) {
    buyScore += 1; reasons.push('Price above EMA crossover');
  } else {
    sellScore += 1; reasons.push('Price below EMA crossover');
  }

  // MACD
  if (macdData.histogram > 0 && ind.macd[last - 1]?.histogram <= 0) {
    buyScore += 2; reasons.push('MACD histogram turned positive');
  } else if (macdData.histogram < 0 && ind.macd[last - 1]?.histogram >= 0) {
    sellScore += 2; reasons.push('MACD histogram turned negative');
  }

  // Bollinger Bands
  if (price <= bb.lower) { buyScore += 2; reasons.push('Price at lower Bollinger Band (support)'); }
  else if (price >= bb.upper) { sellScore += 2; reasons.push('Price at upper Bollinger Band (resistance)'); }

  // SMA trend
  if (sma20 > sma50) { buyScore += 1; reasons.push('SMA 20 above SMA 50 (uptrend)'); }
  else { sellScore += 1; reasons.push('SMA 20 below SMA 50 (downtrend)'); }

  // Volume spike detection
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  if (candles[last].volume > avgVol * 1.5) {
    const spike = buyScore > sellScore ? 'buy' : 'sell';
    if (spike === 'buy') buyScore += 1;
    else sellScore += 1;
    reasons.push(`Volume spike (${(candles[last].volume / avgVol * 100).toFixed(0)}% of avg)`);
  }

  const totalScore = buyScore + sellScore;
  const maxScore = 12;

  let signal: 'buy' | 'sell' | 'hold';
  let confidence: number;

  if (buyScore >= sellScore + 3) {
    signal = 'buy';
    confidence = Math.min(0.95, 0.5 + (buyScore / maxScore) * 0.45);
  } else if (sellScore >= buyScore + 3) {
    signal = 'sell';
    confidence = Math.min(0.95, 0.5 + (sellScore / maxScore) * 0.45);
  } else {
    signal = 'hold';
    confidence = 0.4 + (Math.abs(buyScore - sellScore) / maxScore) * 0.2;
  }

  return { signal, confidence, reasons, indicators };
}

// Generate predicted price based on indicators (simple weighted model)
export function predictNextPrice(candles: OHLCV[]): { predicted: number; direction: 'up' | 'down' | 'neutral'; strength: number } {
  if (candles.length < 50) return { predicted: candles[candles.length - 1]?.close || 0, direction: 'neutral', strength: 0 };

  const ind = computeAllIndicators(candles);
  const last = candles.length - 1;
  const price = candles[last].close;
  const atr = ind.atr14[last] || 0;

  // Weighted factors
  let momentum = 0;

  // EMA momentum
  const emaDiff = (ind.ema12[last] - ind.ema26[last]) / price;
  momentum += emaDiff * 3;

  // MACD momentum
  const macdHist = ind.macd[last].histogram;
  momentum += (macdHist / price) * 2;

  // RSI mean-reversion
  const rsi = ind.rsi14[last];
  if (rsi < 30) momentum += 0.01;
  else if (rsi > 70) momentum -= 0.01;

  // BB position
  const bb = ind.bollingerBands[last];
  const bbPosition = (price - bb.lower) / (bb.upper - bb.lower || 1);
  if (bbPosition < 0.2) momentum += 0.005;
  else if (bbPosition > 0.8) momentum -= 0.005;

  // Recent trend
  const recentReturn = (price - candles[last - 5].close) / candles[last - 5].close;
  momentum += recentReturn * 0.5;

  const predicted = price * (1 + Math.max(-0.05, Math.min(0.05, momentum)));
  const direction = momentum > 0.001 ? 'up' : momentum < -0.001 ? 'down' : 'neutral';
  const strength = Math.min(1, Math.abs(momentum) * 20);

  return { predicted, direction, strength };
}
