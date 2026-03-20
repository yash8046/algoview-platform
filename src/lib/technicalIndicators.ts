// Technical Indicators Library — Enhanced with Regime Detection, ADX, VWAP
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
  adx14: number[];
  vwap: number[];
}

// ============ Core Indicators ============

export function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); }
    else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

export function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes[0];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) ema = closes[0];
    else ema = closes[i] * k + ema * (1 - k);
    result.push(i < period - 1 ? NaN : ema);
  }
  return result;
}

export function calcRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [NaN];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = 1; i < closes.length; i++) {
    if (i < period) { result.push(NaN); continue; }
    if (i === period) { result.push(100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss))); continue; }
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    result.push(100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss)));
  }
  return result;
}

export function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number }[] {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalEma = calcEMA(validMacd, 9);
  const result: { macd: number; signal: number; histogram: number }[] = [];
  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) { result.push({ macd: NaN, signal: NaN, histogram: NaN }); }
    else {
      const sig = si < signalEma.length ? signalEma[si] : NaN;
      result.push({ macd: macdLine[i], signal: sig, histogram: macdLine[i] - (isNaN(sig) ? 0 : sig) });
      si++;
    }
  }
  return result;
}

export function calcBollingerBands(closes: number[], period = 20, stdDev = 2) {
  const sma = calcSMA(closes, period);
  return sma.map((mid, i) => {
    if (isNaN(mid)) return { upper: NaN, middle: NaN, lower: NaN };
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - mid) ** 2;
    const sd = Math.sqrt(sumSq / period);
    return { upper: mid + stdDev * sd, middle: mid, lower: mid - stdDev * sd };
  });
}

export function calcATR(candles: OHLCV[], period = 14): number[] {
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  return calcSMA(trs, period);
}

export function calcReturns(closes: number[]): number[] {
  return closes.map((c, i) => (i === 0 ? 0 : ((c - closes[i - 1]) / closes[i - 1]) * 100));
}

export function calcVolatility(closes: number[], period = 20): number[] {
  const returns = calcReturns(closes);
  return returns.map((_, i) => {
    if (i < period) return NaN;
    const slice = returns.slice(i - period, i);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    return Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  });
}

// ============ NEW: ADX (Average Directional Index) ============

export function calcADX(candles: OHLCV[], period = 14): number[] {
  if (candles.length < period + 1) return candles.map(() => NaN);

  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }

  const smoothedTR = calcEMA(tr, period);
  const smoothedPDM = calcEMA(plusDM, period);
  const smoothedMDM = calcEMA(minusDM, period);

  const dx: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(smoothedTR[i]) || smoothedTR[i] === 0) { dx.push(NaN); continue; }
    const pdi = (smoothedPDM[i] / smoothedTR[i]) * 100;
    const mdi = (smoothedMDM[i] / smoothedTR[i]) * 100;
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : Math.abs(pdi - mdi) / sum * 100);
  }

  return calcEMA(dx.map(v => isNaN(v) ? 0 : v), period);
}

// ============ NEW: VWAP ============

export function calcVWAP(candles: OHLCV[]): number[] {
  let cumVP = 0, cumVol = 0;
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVP += tp * c.volume;
    cumVol += c.volume;
    return cumVol === 0 ? tp : cumVP / cumVol;
  });
}

// ============ Market Regime Detection ============

export type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';

export interface RegimeInfo {
  regime: MarketRegime;
  adx: number;
  trendStrength: number; // 0–1
  volatilityLevel: 'low' | 'normal' | 'high';
}

export function detectRegime(candles: OHLCV[]): RegimeInfo {
  if (candles.length < 50) {
    return { regime: 'ranging', adx: 0, trendStrength: 0, volatilityLevel: 'normal' };
  }

  const closes = candles.map(c => c.close);
  const last = candles.length - 1;
  const adxArr = calcADX(candles);
  const adx = adxArr[last] || 0;
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const vol = calcVolatility(closes);
  const atr = calcATR(candles);

  // Volatility level
  const currentVol = vol[last] || 0;
  const avgVol = vol.slice(-50).filter(v => !isNaN(v));
  const medianVol = avgVol.length > 0 ? avgVol.sort((a, b) => a - b)[Math.floor(avgVol.length / 2)] : currentVol;
  const volatilityLevel = currentVol > medianVol * 1.5 ? 'high' : currentVol < medianVol * 0.7 ? 'low' : 'normal';

  // ATR as % of price
  const atrPct = atr[last] / closes[last] * 100;

  let regime: MarketRegime;
  let trendStrength: number;

  if (adx > 25) {
    // Trending market
    trendStrength = Math.min(1, (adx - 15) / 40);
    regime = sma20[last] > sma50[last] ? 'trending_up' : 'trending_down';
  } else if (atrPct > 3 || volatilityLevel === 'high') {
    regime = 'volatile';
    trendStrength = 0.2;
  } else {
    regime = 'ranging';
    trendStrength = Math.max(0, (adx - 10) / 30);
  }

  return { regime, adx, trendStrength, volatilityLevel };
}

// ============ Enhanced Signal Generation ============

export interface TradeSignal {
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasons: string[];
  regime: RegimeInfo;
  riskMetrics: {
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    positionSizePct: number;
    riskRewardRatio: number;
  };
  indicators: {
    rsi: number; macd: number; macdSignal: number;
    sma20: number; sma50: number; ema12: number; ema26: number;
    bbUpper: number; bbLower: number; bbMiddle: number;
    atr: number; volatility: number; price: number;
    adx: number; vwap: number;
  };
}

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
    adx14: calcADX(candles),
    vwap: calcVWAP(candles),
  };
}

export function generateRuleBasedSignal(candles: OHLCV[]): TradeSignal {
  const defaultRisk = { suggestedStopLoss: 0, suggestedTakeProfit: 0, positionSizePct: 0, riskRewardRatio: 0 };
  const defaultRegime: RegimeInfo = { regime: 'ranging', adx: 0, trendStrength: 0, volatilityLevel: 'normal' };

  if (candles.length < 50) {
    return {
      signal: 'hold', confidence: 0,
      reasons: ['Insufficient data for analysis'],
      regime: defaultRegime, riskMetrics: defaultRisk,
      indicators: { rsi: 0, macd: 0, macdSignal: 0, sma20: 0, sma50: 0, ema12: 0, ema26: 0, bbUpper: 0, bbLower: 0, bbMiddle: 0, atr: 0, volatility: 0, price: 0, adx: 0, vwap: 0 },
    };
  }

  const ind = computeAllIndicators(candles);
  const last = candles.length - 1;
  const price = candles[last].close;
  const regime = detectRegime(candles);

  const rsi = ind.rsi14[last];
  const macdData = ind.macd[last];
  const sma20 = ind.sma20[last];
  const sma50 = ind.sma50[last];
  const ema12 = ind.ema12[last];
  const ema26 = ind.ema26[last];
  const bb = ind.bollingerBands[last];
  const atr = ind.atr14[last];
  const vol = ind.volatility20[last];
  const adx = ind.adx14[last];
  const vwap = ind.vwap[last];

  const indicators = {
    rsi, macd: macdData.macd, macdSignal: macdData.signal,
    sma20, sma50, ema12, ema26,
    bbUpper: bb.upper, bbLower: bb.lower, bbMiddle: bb.middle,
    atr, volatility: vol, price, adx, vwap,
  };

  let buyScore = 0, sellScore = 0;
  const reasons: string[] = [];

  // Regime context
  reasons.push(`Market regime: ${regime.regime.replace('_', ' ')} (ADX: ${adx.toFixed(1)})`);

  // --- RSI ---
  if (rsi < 30) { buyScore += 2; reasons.push(`RSI oversold at ${rsi.toFixed(1)}`); }
  else if (rsi < 40) { buyScore += 1; }
  else if (rsi > 70) { sellScore += 2; reasons.push(`RSI overbought at ${rsi.toFixed(1)}`); }
  else if (rsi > 60) { sellScore += 1; }

  // --- EMA crossover ---
  if (ema12 > ema26 && ind.ema12[last - 1] <= ind.ema26[last - 1]) {
    buyScore += 3; reasons.push('Bullish EMA 12/26 crossover');
  } else if (ema12 < ema26 && ind.ema12[last - 1] >= ind.ema26[last - 1]) {
    sellScore += 3; reasons.push('Bearish EMA 12/26 crossover');
  } else if (ema12 > ema26) { buyScore += 1; }
  else { sellScore += 1; }

  // --- MACD ---
  if (macdData.histogram > 0 && ind.macd[last - 1]?.histogram <= 0) {
    buyScore += 2; reasons.push('MACD histogram turned positive');
  } else if (macdData.histogram < 0 && ind.macd[last - 1]?.histogram >= 0) {
    sellScore += 2; reasons.push('MACD histogram turned negative');
  }

  // --- Bollinger Bands ---
  if (price <= bb.lower) { buyScore += 2; reasons.push('Price at lower Bollinger Band'); }
  else if (price >= bb.upper) { sellScore += 2; reasons.push('Price at upper Bollinger Band'); }

  // --- SMA trend ---
  if (sma20 > sma50) { buyScore += 1; reasons.push('SMA 20 > SMA 50 (uptrend)'); }
  else { sellScore += 1; reasons.push('SMA 20 < SMA 50 (downtrend)'); }

  // --- VWAP ---
  if (price > vwap * 1.005) { buyScore += 1; reasons.push('Price above VWAP'); }
  else if (price < vwap * 0.995) { sellScore += 1; reasons.push('Price below VWAP'); }

  // --- Volume filter ---
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const volRatio = candles[last].volume / avgVol;
  if (volRatio < 0.5) {
    // Low volume → reduce confidence
    reasons.push(`Low volume (${(volRatio * 100).toFixed(0)}% of avg) — signal weakened`);
  } else if (volRatio > 1.5) {
    const dir = buyScore > sellScore ? 'buy' : 'sell';
    if (dir === 'buy') buyScore += 1; else sellScore += 1;
    reasons.push(`Volume spike (${(volRatio * 100).toFixed(0)}% of avg)`);
  }

  // --- Regime-based filter ---
  // In ranging/volatile markets, require stronger signals
  const regimeMultiplier = regime.regime === 'ranging' ? 0.7 :
    regime.regime === 'volatile' ? 0.6 :
    regime.trendStrength > 0.5 ? 1.2 : 1.0;

  // --- Volatility filter ---
  const atrPct = atr / price * 100;
  if (atrPct > 3) {
    reasons.push(`High volatility (ATR ${atrPct.toFixed(2)}%) — caution`);
  }

  // --- Final scoring ---
  const maxScore = 14;
  let signal: 'buy' | 'sell' | 'hold';
  let confidence: number;

  if (buyScore >= sellScore + 3) {
    signal = 'buy';
    confidence = Math.min(0.95, (0.5 + (buyScore / maxScore) * 0.45) * regimeMultiplier);
  } else if (sellScore >= buyScore + 3) {
    signal = 'sell';
    confidence = Math.min(0.95, (0.5 + (sellScore / maxScore) * 0.45) * regimeMultiplier);
  } else {
    signal = 'hold';
    confidence = 0.3 + (Math.abs(buyScore - sellScore) / maxScore) * 0.2;
  }

  // Low volume penalty
  if (volRatio < 0.5) confidence *= 0.7;

  // Risk metrics
  const stopLossMultiplier = regime.volatilityLevel === 'high' ? 3 : 2;
  const suggestedStopLoss = signal === 'buy'
    ? price - atr * stopLossMultiplier
    : signal === 'sell' ? price + atr * stopLossMultiplier : 0;
  const suggestedTakeProfit = signal === 'buy'
    ? price + atr * stopLossMultiplier * 2
    : signal === 'sell' ? price - atr * stopLossMultiplier * 2 : 0;

  const riskPerTrade = Math.abs(price - suggestedStopLoss);
  const reward = Math.abs(suggestedTakeProfit - price);
  const riskRewardRatio = riskPerTrade > 0 ? reward / riskPerTrade : 0;

  // Kelly-inspired position sizing
  const winRate = 0.55;
  const kellyFraction = (winRate * riskRewardRatio - (1 - winRate)) / riskRewardRatio;
  const positionSizePct = Math.max(0.01, Math.min(0.2, kellyFraction * 0.25 * confidence));

  return {
    signal, confidence, reasons, regime,
    riskMetrics: { suggestedStopLoss, suggestedTakeProfit, positionSizePct, riskRewardRatio },
    indicators,
  };
}

// ============ Price Prediction ============

export function predictNextPrice(candles: OHLCV[]): { predicted: number; direction: 'up' | 'down' | 'neutral'; strength: number } {
  if (candles.length < 50) return { predicted: candles[candles.length - 1]?.close || 0, direction: 'neutral', strength: 0 };

  const ind = computeAllIndicators(candles);
  const last = candles.length - 1;
  const price = candles[last].close;

  let momentum = 0;
  const emaDiff = (ind.ema12[last] - ind.ema26[last]) / price;
  momentum += emaDiff * 3;
  momentum += (ind.macd[last].histogram / price) * 2;

  const rsi = ind.rsi14[last];
  if (rsi < 30) momentum += 0.01;
  else if (rsi > 70) momentum -= 0.01;

  const bb = ind.bollingerBands[last];
  const bbPos = (price - bb.lower) / (bb.upper - bb.lower || 1);
  if (bbPos < 0.2) momentum += 0.005;
  else if (bbPos > 0.8) momentum -= 0.005;

  const recentReturn = (price - candles[last - 5].close) / candles[last - 5].close;
  momentum += recentReturn * 0.5;

  const predicted = price * (1 + Math.max(-0.05, Math.min(0.05, momentum)));
  const direction = momentum > 0.001 ? 'up' : momentum < -0.001 ? 'down' : 'neutral';
  const strength = Math.min(1, Math.abs(momentum) * 20);

  return { predicted, direction, strength };
}

// ============ Backtesting Engine ============

export interface BacktestConfig {
  initialCapital: number;
  maxRiskPerTrade: number;   // fraction (0.02 = 2%)
  minConfidence: number;     // minimum signal confidence to trade
  stopLossATRMultiplier: number;
  takeProfitATRMultiplier: number;
  commissionPct: number;     // per trade (e.g. 0.001 = 0.1%)
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  quantity: number;
  pnl: number;
  pnlPct: number;
  signal: 'buy' | 'sell';
  confidence: number;
}

export interface BacktestResult {
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  calmarRatio: number;
  equityCurve: { time: number; equity: number }[];
  trades: BacktestTrade[];
}

const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 100000,
  maxRiskPerTrade: 0.02,
  minConfidence: 0.55,
  stopLossATRMultiplier: 2,
  takeProfitATRMultiplier: 4,
  commissionPct: 0.001,
};

export function runBacktest(candles: OHLCV[], config: Partial<BacktestConfig> = {}): BacktestResult {
  const cfg = { ...DEFAULT_BACKTEST_CONFIG, ...config };
  let capital = cfg.initialCapital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: { time: number; equity: number }[] = [];

  let inPosition = false;
  let positionSide: 'long' | 'short' = 'long';
  let entryPrice = 0;
  let entryTime = 0;
  let positionQty = 0;
  let stopLoss = 0;
  let takeProfit = 0;
  let entryConfidence = 0;

  // Walk through candles with a sliding window
  const windowSize = 100;

  for (let i = windowSize; i < candles.length; i++) {
    const window = candles.slice(i - windowSize, i + 1);
    const currentCandle = candles[i];
    const price = currentCandle.close;

    // Track equity
    let currentEquity = capital;
    if (inPosition) {
      const unrealizedPnl = positionSide === 'long'
        ? (price - entryPrice) * positionQty
        : (entryPrice - price) * positionQty;
      currentEquity = capital + unrealizedPnl;
    }
    equityCurve.push({ time: currentCandle.time, equity: currentEquity });

    // Drawdown tracking
    if (currentEquity > peakCapital) peakCapital = currentEquity;
    const dd = peakCapital - currentEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (inPosition) {
      // Check stop loss / take profit
      let exitPrice = 0;
      let exitReason = '';

      if (positionSide === 'long') {
        if (currentCandle.low <= stopLoss) { exitPrice = stopLoss; exitReason = 'stop'; }
        else if (currentCandle.high >= takeProfit) { exitPrice = takeProfit; exitReason = 'tp'; }
      } else {
        if (currentCandle.high >= stopLoss) { exitPrice = stopLoss; exitReason = 'stop'; }
        else if (currentCandle.low <= takeProfit) { exitPrice = takeProfit; exitReason = 'tp'; }
      }

      if (exitPrice > 0) {
        const grossPnl = positionSide === 'long'
          ? (exitPrice - entryPrice) * positionQty
          : (entryPrice - exitPrice) * positionQty;
        const commission = exitPrice * positionQty * cfg.commissionPct * 2; // entry + exit
        const netPnl = grossPnl - commission;

        capital += netPnl;
        trades.push({
          entryTime, exitTime: currentCandle.time,
          entryPrice, exitPrice, side: positionSide,
          quantity: positionQty, pnl: netPnl,
          pnlPct: (netPnl / (entryPrice * positionQty)) * 100,
          signal: positionSide === 'long' ? 'buy' : 'sell',
          confidence: entryConfidence,
        });
        inPosition = false;
      }
    }

    if (!inPosition && i < candles.length - 5) {
      // Generate signal
      const signal = generateRuleBasedSignal(window);

      if (signal.signal !== 'hold' && signal.confidence >= cfg.minConfidence) {
        const atr = signal.indicators.atr;
        if (atr <= 0) continue;

        // Position sizing based on risk
        const riskAmount = capital * cfg.maxRiskPerTrade;
        const slDistance = atr * cfg.stopLossATRMultiplier;
        positionQty = Math.floor(riskAmount / slDistance);
        if (positionQty <= 0) continue;

        // Ensure we can afford
        const cost = price * positionQty;
        if (cost > capital * 0.95) continue;

        entryPrice = price;
        entryTime = currentCandle.time;
        entryConfidence = signal.confidence;

        if (signal.signal === 'buy') {
          positionSide = 'long';
          stopLoss = price - slDistance;
          takeProfit = price + atr * cfg.takeProfitATRMultiplier;
        } else {
          positionSide = 'short';
          stopLoss = price + slDistance;
          takeProfit = price - atr * cfg.takeProfitATRMultiplier;
        }
        inPosition = true;
      }
    }
  }

  // Close any remaining position at last price
  if (inPosition) {
    const lastPrice = candles[candles.length - 1].close;
    const grossPnl = positionSide === 'long'
      ? (lastPrice - entryPrice) * positionQty
      : (entryPrice - lastPrice) * positionQty;
    const commission = lastPrice * positionQty * cfg.commissionPct * 2;
    capital += grossPnl - commission;
    trades.push({
      entryTime, exitTime: candles[candles.length - 1].time,
      entryPrice, exitPrice: lastPrice, side: positionSide,
      quantity: positionQty, pnl: grossPnl - commission,
      pnlPct: ((grossPnl - commission) / (entryPrice * positionQty)) * 100,
      signal: positionSide === 'long' ? 'buy' : 'sell',
      confidence: entryConfidence,
    });
  }

  // Compute metrics
  const totalReturn = capital - cfg.initialCapital;
  const totalReturnPct = (totalReturn / cfg.initialCapital) * 100;
  const maxDrawdownPct = peakCapital > 0 ? (maxDrawdown / peakCapital) * 100 : 0;

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  // Sharpe Ratio (simplified)
  const returns = equityCurve.map((e, i) =>
    i === 0 ? 0 : (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity
  ).slice(1);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  const calmarRatio = maxDrawdownPct > 0 ? totalReturnPct / maxDrawdownPct : 0;

  return {
    totalReturn, totalReturnPct, sharpeRatio, maxDrawdown, maxDrawdownPct,
    winRate, profitFactor, totalTrades: trades.length,
    winningTrades: wins.length, losingTrades: losses.length,
    avgWin, avgLoss, calmarRatio, equityCurve, trades,
  };
}
