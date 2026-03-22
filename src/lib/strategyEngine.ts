// Custom Strategy Builder Engine
import { OHLCV, calcSMA, calcEMA, calcRSI, calcMACD, calcBollingerBands, calcATR } from './technicalIndicators';

export type IndicatorType = 'EMA' | 'SMA' | 'RSI' | 'MACD' | 'BollingerBands' | 'ATR';

export interface IndicatorConfig {
  type: IndicatorType;
  params: Record<string, number>;
}

export const DEFAULT_INDICATOR_PARAMS: Record<IndicatorType, Record<string, number>> = {
  EMA: { period: 12 },
  SMA: { period: 20 },
  RSI: { period: 14 },
  MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  BollingerBands: { period: 20, stdDev: 2 },
  ATR: { period: 14 },
};

export type ConditionOperator = '>' | '<' | 'crosses_above' | 'crosses_below';

export type ConditionSource =
  | 'price' | 'ema1' | 'ema2' | 'sma1' | 'sma2'
  | 'rsi' | 'macd_line' | 'macd_signal' | 'macd_histogram'
  | 'bb_upper' | 'bb_lower' | 'bb_middle'
  | 'value';

export interface RuleCondition {
  id: string;
  left: ConditionSource;
  operator: ConditionOperator;
  right: ConditionSource;
  rightValue?: number; // used when right === 'value'
}

export type StopLossType = 'percentage' | 'atr';
export type TakeProfitType = 'percentage' | 'rr_ratio';

export interface StrategyDefinition {
  name: string;
  description: string;
  market: 'crypto' | 'stocks' | 'forex';
  indicators: IndicatorConfig[];
  entryConditions: RuleCondition[];
  exitConditions: RuleCondition[];
  stopLoss: { type: StopLossType; value: number };
  takeProfit: { type: TakeProfitType; value: number };
  initialCapital: number;
  positionSizePct: number; // % of capital per trade
  commissionPct: number;
}

export interface StrategyTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  quantity: number;
  pnl: number;
  pnlPct: number;
  exitReason: 'signal' | 'stop_loss' | 'take_profit' | 'end';
  duration: number; // in candles
}

export interface StrategyResult {
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
  equityCurve: { time: number; equity: number }[];
  drawdownCurve: { time: number; drawdown: number }[];
  trades: StrategyTrade[];
}

// Compute all indicator values for the strategy
function computeStrategyIndicators(candles: OHLCV[], indicators: IndicatorConfig[]) {
  const closes = candles.map(c => c.close);
  const result: Record<string, number[]> = { price: closes };

  let emaCount = 0, smaCount = 0;

  for (const ind of indicators) {
    switch (ind.type) {
      case 'EMA': {
        emaCount++;
        result[`ema${emaCount}`] = calcEMA(closes, ind.params.period);
        break;
      }
      case 'SMA': {
        smaCount++;
        result[`sma${smaCount}`] = calcSMA(closes, ind.params.period);
        break;
      }
      case 'RSI': {
        result.rsi = calcRSI(closes, ind.params.period);
        break;
      }
      case 'MACD': {
        const macd = calcMACD(closes);
        result.macd_line = macd.map(m => m.macd);
        result.macd_signal = macd.map(m => m.signal);
        result.macd_histogram = macd.map(m => m.histogram);
        break;
      }
      case 'BollingerBands': {
        const bb = calcBollingerBands(closes, ind.params.period, ind.params.stdDev);
        result.bb_upper = bb.map(b => b.upper);
        result.bb_lower = bb.map(b => b.lower);
        result.bb_middle = bb.map(b => b.middle);
        break;
      }
      case 'ATR': {
        result.atr = calcATR(candles, ind.params.period);
        break;
      }
    }
  }

  return result;
}

function getSourceValue(source: ConditionSource, index: number, indicators: Record<string, number[]>, constValue?: number): number {
  if (source === 'value') return constValue ?? 0;
  return indicators[source]?.[index] ?? NaN;
}

function evaluateCondition(cond: RuleCondition, index: number, indicators: Record<string, number[]>): boolean {
  const left = getSourceValue(cond.left, index, indicators);
  const right = getSourceValue(cond.right, index, indicators, cond.rightValue);

  if (isNaN(left) || isNaN(right)) return false;

  switch (cond.operator) {
    case '>': return left > right;
    case '<': return left < right;
    case 'crosses_above': {
      if (index < 1) return false;
      const prevLeft = getSourceValue(cond.left, index - 1, indicators);
      const prevRight = getSourceValue(cond.right, index - 1, indicators, cond.rightValue);
      if (isNaN(prevLeft) || isNaN(prevRight)) return false;
      return prevLeft <= prevRight && left > right;
    }
    case 'crosses_below': {
      if (index < 1) return false;
      const prevLeft = getSourceValue(cond.left, index - 1, indicators);
      const prevRight = getSourceValue(cond.right, index - 1, indicators, cond.rightValue);
      if (isNaN(prevLeft) || isNaN(prevRight)) return false;
      return prevLeft >= prevRight && left < right;
    }
  }
  return false;
}

function evaluateAllConditions(conditions: RuleCondition[], index: number, indicators: Record<string, number[]>): boolean {
  if (conditions.length === 0) return false;
  return conditions.every(c => evaluateCondition(c, index, indicators));
}

export function runCustomStrategy(candles: OHLCV[], strategy: StrategyDefinition): StrategyResult {
  const indicators = computeStrategyIndicators(candles, strategy.indicators);
  const atr = calcATR(candles);

  let capital = strategy.initialCapital;
  let peakCapital = capital;
  let maxDrawdown = 0;
  const trades: StrategyTrade[] = [];
  const equityCurve: { time: number; equity: number }[] = [];
  const drawdownCurve: { time: number; drawdown: number }[] = [];

  let inPosition = false;
  let entryPrice = 0;
  let entryTime = 0;
  let entryIndex = 0;
  let positionQty = 0;
  let stopLossPrice = 0;
  let takeProfitPrice = 0;

  const startIndex = 50; // warm-up period

  for (let i = startIndex; i < candles.length; i++) {
    const price = candles[i].close;

    // Track equity
    let currentEquity = capital;
    if (inPosition) {
      currentEquity = capital + (price - entryPrice) * positionQty;
    }
    equityCurve.push({ time: candles[i].time, equity: currentEquity });

    if (currentEquity > peakCapital) peakCapital = currentEquity;
    const dd = peakCapital - currentEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;
    drawdownCurve.push({ time: candles[i].time, drawdown: peakCapital > 0 ? (dd / peakCapital) * 100 : 0 });

    if (inPosition) {
      // Check stop loss / take profit
      let exitPrice = 0;
      let exitReason: StrategyTrade['exitReason'] = 'signal';

      if (candles[i].low <= stopLossPrice) {
        exitPrice = stopLossPrice;
        exitReason = 'stop_loss';
      } else if (candles[i].high >= takeProfitPrice) {
        exitPrice = takeProfitPrice;
        exitReason = 'take_profit';
      } else if (evaluateAllConditions(strategy.exitConditions, i, indicators)) {
        exitPrice = price;
        exitReason = 'signal';
      }

      if (exitPrice > 0) {
        const grossPnl = (exitPrice - entryPrice) * positionQty;
        const commission = (entryPrice + exitPrice) * positionQty * strategy.commissionPct;
        const netPnl = grossPnl - commission;
        capital += netPnl;

        trades.push({
          entryTime, exitTime: candles[i].time,
          entryPrice, exitPrice, side: 'long',
          quantity: positionQty, pnl: netPnl,
          pnlPct: (netPnl / (entryPrice * positionQty)) * 100,
          exitReason,
          duration: i - entryIndex,
        });
        inPosition = false;
      }
    }

    if (!inPosition && i < candles.length - 2) {
      if (evaluateAllConditions(strategy.entryConditions, i, indicators)) {
        const positionValue = capital * (strategy.positionSizePct / 100);
        positionQty = positionValue / price; // Allow fractional quantities for expensive assets
        if (positionQty <= 0.001 || positionQty * price > capital * 0.95) continue;

        entryPrice = price;
        entryTime = candles[i].time;
        entryIndex = i;
        inPosition = true;

        // Calculate stop loss
        const currentATR = atr[i] || price * 0.02;
        if (strategy.stopLoss.type === 'percentage') {
          stopLossPrice = price * (1 - strategy.stopLoss.value / 100);
        } else {
          stopLossPrice = price - currentATR * strategy.stopLoss.value;
        }

        // Calculate take profit
        if (strategy.takeProfit.type === 'percentage') {
          takeProfitPrice = price * (1 + strategy.takeProfit.value / 100);
        } else {
          const riskDistance = price - stopLossPrice;
          takeProfitPrice = price + riskDistance * strategy.takeProfit.value;
        }
      }
    }
  }

  // Close remaining position
  if (inPosition) {
    const lastPrice = candles[candles.length - 1].close;
    const grossPnl = (lastPrice - entryPrice) * positionQty;
    const commission = (entryPrice + lastPrice) * positionQty * strategy.commissionPct;
    capital += grossPnl - commission;
    trades.push({
      entryTime, exitTime: candles[candles.length - 1].time,
      entryPrice, exitPrice: lastPrice, side: 'long',
      quantity: positionQty, pnl: grossPnl - commission,
      pnlPct: ((grossPnl - commission) / (entryPrice * positionQty)) * 100,
      exitReason: 'end',
      duration: candles.length - 1 - entryIndex,
    });
  }

  // Metrics
  const totalReturn = capital - strategy.initialCapital;
  const totalReturnPct = (totalReturn / strategy.initialCapital) * 100;
  const maxDrawdownPct = peakCapital > 0 ? (maxDrawdown / peakCapital) * 100 : 0;

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  const returns = equityCurve.map((e, i) =>
    i === 0 ? 0 : (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity
  ).slice(1);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    totalReturn, totalReturnPct, sharpeRatio, maxDrawdown, maxDrawdownPct,
    winRate, profitFactor, totalTrades: trades.length,
    winningTrades: wins.length, losingTrades: losses.length,
    avgWin, avgLoss, equityCurve, drawdownCurve, trades,
  };
}

// Strategy Templates
export const STRATEGY_TEMPLATES: StrategyDefinition[] = [
  {
    name: 'EMA Crossover',
    description: 'Buy when fast EMA crosses above slow EMA, sell when it crosses below',
    market: 'stocks',
    indicators: [
      { type: 'EMA', params: { period: 9 } },
      { type: 'EMA', params: { period: 21 } },
    ],
    entryConditions: [
      { id: '1', left: 'ema1', operator: 'crosses_above', right: 'ema2' },
    ],
    exitConditions: [
      { id: '1', left: 'ema1', operator: 'crosses_below', right: 'ema2' },
    ],
    stopLoss: { type: 'atr', value: 2 },
    takeProfit: { type: 'rr_ratio', value: 3 },
    initialCapital: 100000,
    positionSizePct: 10,
    commissionPct: 0.001,
  },
  {
    name: 'RSI Reversal',
    description: 'Buy when RSI crosses above 30 (oversold), exit when RSI crosses above 70',
    market: 'stocks',
    indicators: [
      { type: 'RSI', params: { period: 14 } },
    ],
    entryConditions: [
      { id: '1', left: 'rsi', operator: 'crosses_above', right: 'value', rightValue: 30 },
    ],
    exitConditions: [
      { id: '1', left: 'rsi', operator: '>', right: 'value', rightValue: 70 },
    ],
    stopLoss: { type: 'percentage', value: 3 },
    takeProfit: { type: 'percentage', value: 6 },
    initialCapital: 100000,
    positionSizePct: 10,
    commissionPct: 0.001,
  },
  {
    name: 'Bollinger Bounce',
    description: 'Buy at lower BB, sell at upper BB with RSI confirmation',
    market: 'crypto',
    indicators: [
      { type: 'BollingerBands', params: { period: 20, stdDev: 2 } },
      { type: 'RSI', params: { period: 14 } },
    ],
    entryConditions: [
      { id: '1', left: 'price', operator: '<', right: 'bb_lower' },
      { id: '2', left: 'rsi', operator: '<', right: 'value', rightValue: 35 },
    ],
    exitConditions: [
      { id: '1', left: 'price', operator: '>', right: 'bb_upper' },
    ],
    stopLoss: { type: 'percentage', value: 4 },
    takeProfit: { type: 'rr_ratio', value: 2.5 },
    initialCapital: 100000,
    positionSizePct: 15,
    commissionPct: 0.001,
  },
  {
    name: 'MACD Momentum',
    description: 'Enter on MACD histogram turning positive, exit on turning negative',
    market: 'stocks',
    indicators: [
      { type: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      { type: 'SMA', params: { period: 50 } },
    ],
    entryConditions: [
      { id: '1', left: 'macd_line', operator: 'crosses_above', right: 'macd_signal' },
      { id: '2', left: 'price', operator: '>', right: 'sma1' },
    ],
    exitConditions: [
      { id: '1', left: 'macd_line', operator: 'crosses_below', right: 'macd_signal' },
    ],
    stopLoss: { type: 'atr', value: 1.5 },
    takeProfit: { type: 'rr_ratio', value: 2 },
    initialCapital: 100000,
    positionSizePct: 10,
    commissionPct: 0.001,
  },
];

export function exportTradesCSV(trades: StrategyTrade[]): string {
  const header = 'Entry Time,Exit Time,Entry Price,Exit Price,Side,Quantity,P&L,P&L %,Exit Reason,Duration (bars)\n';
  const rows = trades.map(t =>
    `${new Date(t.entryTime * 1000).toISOString()},${new Date(t.exitTime * 1000).toISOString()},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.side},${t.quantity},${t.pnl.toFixed(2)},${t.pnlPct.toFixed(2)}%,${t.exitReason},${t.duration}`
  ).join('\n');
  return header + rows;
}
