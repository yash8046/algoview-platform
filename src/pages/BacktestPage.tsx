import { useState, useEffect, useMemo, useRef } from 'react';
import { createChart, LineSeries, type IChartApi } from 'lightweight-charts';
import TopBar from '@/components/TopBar';
import { fetchKlines, type BinanceCandle } from '@/lib/binanceApi';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { type OHLCV, type BacktestResult, type BacktestConfig, runBacktest } from '@/lib/technicalIndicators';
import { CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Play, Settings, ChevronDown } from 'lucide-react';

const STOCK_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'LT', 'WIPRO', 'BHARTIARTL', 'ITC', 'SBIN'];

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-mono text-sm font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-gain' : 'text-loss'}`}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartRef.current || result.equityCurve.length === 0) return;
    if (chartInstance.current) chartInstance.current.remove();

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: 'hsl(222, 47%, 5%)' },
        textColor: 'hsl(215, 15%, 50%)',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'hsl(222, 30%, 12%)' },
        horzLines: { color: 'hsl(222, 30%, 12%)' },
      },
      rightPriceScale: { borderColor: 'hsl(222, 30%, 18%)' },
      timeScale: { borderColor: 'hsl(222, 30%, 18%)', timeVisible: true },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(LineSeries, {
      color: result.totalReturn >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)',
      lineWidth: 2,
      priceLineVisible: false,
    });

    // Sample every Nth point for performance
    const maxPoints = 500;
    const step = Math.max(1, Math.floor(result.equityCurve.length / maxPoints));
    const data = result.equityCurve
      .filter((_, i) => i % step === 0)
      .map(e => ({ time: e.time as any, value: e.equity }));
    series.setData(data);
    chart.timeScale().fitContent();
    chartInstance.current = chart;

    const observer = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
    });
    observer.observe(chartRef.current);

    return () => { observer.disconnect(); chart.remove(); chartInstance.current = null; };
  }, [result]);

  return <div ref={chartRef} className="w-full h-full" />;
}

function TradesTable({ trades }: { trades: BacktestResult['trades'] }) {
  return (
    <div className="overflow-auto max-h-64 scrollbar-thin">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1.5 px-2">Side</th>
            <th className="text-right py-1.5 px-2">Entry</th>
            <th className="text-right py-1.5 px-2">Exit</th>
            <th className="text-right py-1.5 px-2">Qty</th>
            <th className="text-right py-1.5 px-2">P&L</th>
            <th className="text-right py-1.5 px-2">P&L %</th>
            <th className="text-right py-1.5 px-2">Conf</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
              <td className={`py-1.5 px-2 font-semibold uppercase ${t.side === 'long' ? 'text-gain' : 'text-loss'}`}>{t.side}</td>
              <td className="py-1.5 px-2 text-right font-mono">{t.entryPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{t.exitPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{t.quantity}</td>
              <td className={`py-1.5 px-2 text-right font-mono font-semibold ${t.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
              </td>
              <td className={`py-1.5 px-2 text-right font-mono ${t.pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
              </td>
              <td className="py-1.5 px-2 text-right font-mono">{(t.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BacktestPage() {
  const [assetType, setAssetType] = useState<'crypto' | 'stock'>('crypto');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval_] = useState('1h');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<BacktestConfig>({
    initialCapital: 100000,
    maxRiskPerTrade: 0.02,
    minConfidence: 0.55,
    stopLossATRMultiplier: 2,
    takeProfitATRMultiplier: 4,
    commissionPct: 0.001,
  });

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      let candles: OHLCV[];

      if (assetType === 'crypto') {
        const raw = await fetchKlines(symbol, interval, 1000);
        candles = raw.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      } else {
        const tf = interval === '1h' ? '1H' : interval === '1d' ? '1D' : '1D';
        const data = await fetchYahooFinanceData(symbol, tf);
        candles = data.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      }

      if (candles.length < 150) {
        setError(`Only ${candles.length} candles available. Need at least 150 for meaningful backtest.`);
        setRunning(false);
        return;
      }

      const backtestResult = runBacktest(candles, config);
      setResult(backtestResult);
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-3 p-3 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Strategy Backtester</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">
              Historical Simulation
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Asset Type</label>
              <div className="flex gap-1">
                {(['crypto', 'stock'] as const).map(t => (
                  <button key={t} onClick={() => { setAssetType(t); setSymbol(t === 'crypto' ? 'BTCUSDT' : 'RELIANCE'); }}
                    className={`px-3 py-1.5 text-xs rounded capitalize transition-colors ${assetType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Symbol</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)}
                className="bg-secondary text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border">
                {assetType === 'crypto'
                  ? CRYPTO_PAIRS.map(p => <option key={p.symbol} value={p.symbol}>{p.label}</option>)
                  : STOCK_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)
                }
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Interval</label>
              <select value={interval} onChange={e => setInterval_(e.target.value)}
                className="bg-secondary text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border">
                {assetType === 'crypto'
                  ? [{ v: '1m', l: '1m' }, { v: '5m', l: '5m' }, { v: '15m', l: '15m' }, { v: '1h', l: '1h' }, { v: '1d', l: '1D' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                  : [{ v: '1h', l: '1H' }, { v: '1d', l: '1D' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                }
              </select>
            </div>

            <button onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Config
              <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
            </button>

            <button onClick={runTest} disabled={running}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Play className="w-3.5 h-3.5" />
              {running ? 'Running...' : 'Run Backtest'}
            </button>
          </div>

          {/* Config panel */}
          {showConfig && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { key: 'initialCapital', label: 'Capital', step: 10000, prefix: '₹' },
                { key: 'maxRiskPerTrade', label: 'Max Risk/Trade', step: 0.005, prefix: '', suffix: '%', mult: 100 },
                { key: 'minConfidence', label: 'Min Confidence', step: 0.05, prefix: '', suffix: '%', mult: 100 },
                { key: 'stopLossATRMultiplier', label: 'SL ATR×', step: 0.5 },
                { key: 'takeProfitATRMultiplier', label: 'TP ATR×', step: 0.5 },
                { key: 'commissionPct', label: 'Commission', step: 0.0005, prefix: '', suffix: '%', mult: 100 },
              ].map(({ key, label, step, prefix, suffix, mult }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
                  <input type="number" step={step}
                    value={mult ? (config as any)[key] * mult : (config as any)[key]}
                    onChange={e => setConfig({ ...config, [key]: mult ? Number(e.target.value) / mult : Number(e.target.value) })}
                    className="w-full bg-secondary text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-loss/10 border border-loss/20">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <span className="text-xs text-loss">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <MetricCard label="Total Return" value={`${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toFixed(2)}%`}
                sub={`₹${result.totalReturn.toFixed(0)}`} positive={result.totalReturn >= 0} />
              <MetricCard label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)}
                positive={result.sharpeRatio > 1} />
              <MetricCard label="Max Drawdown" value={`-${result.maxDrawdownPct.toFixed(2)}%`}
                sub={`₹${result.maxDrawdown.toFixed(0)}`} positive={result.maxDrawdownPct < 15} />
              <MetricCard label="Win Rate" value={`${(result.winRate * 100).toFixed(1)}%`}
                sub={`${result.winningTrades}W / ${result.losingTrades}L`} positive={result.winRate > 0.5} />
              <MetricCard label="Profit Factor" value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
                positive={result.profitFactor > 1.5} />
              <MetricCard label="Calmar Ratio" value={result.calmarRatio.toFixed(2)}
                positive={result.calmarRatio > 1} />
              <MetricCard label="Avg Win" value={`₹${result.avgWin.toFixed(0)}`} positive={true} />
              <MetricCard label="Avg Loss" value={`₹${result.avgLoss.toFixed(0)}`} positive={false} />
            </div>

            {/* Equity curve */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Equity Curve</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{result.totalTrades} trades</span>
              </div>
              <div style={{ height: 280 }}>
                <EquityChart result={result} />
              </div>
            </div>

            {/* Trade history */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Trade History</h3>
                <span className="text-[10px] text-muted-foreground">{result.trades.length} trades</span>
              </div>
              <TradesTable trades={result.trades} />
            </div>
          </>
        )}

        {!result && !running && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <BarChart3 className="w-12 h-12 opacity-20" />
            <p className="text-sm">Configure parameters and run a backtest to see results</p>
            <p className="text-[10px] text-muted-foreground/60">Uses real historical data • Walk-forward signal generation • Includes commissions</p>
          </div>
        )}
      </div>
    </div>
  );
}
