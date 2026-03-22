import { useState, useEffect, useRef } from 'react';
import { createChart, LineSeries, type IChartApi } from 'lightweight-charts';
import TopBar from '@/components/TopBar';
import { fetchKlines } from '@/lib/binanceApi';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { type OHLCV, type BacktestResult, type BacktestConfig, runBacktest } from '@/lib/technicalIndicators';
import { CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, AlertTriangle, Play, Settings, ChevronDown, Info, Search, X } from 'lucide-react';

interface StockOption {
  symbol: string;
  name: string;
}

const STRATEGY_PRESETS = [
  { id: 'default', name: 'AI Ensemble', description: 'RSI + MACD + Bollinger + ADX combined signals' },
  { id: 'trend_follow', name: 'Trend Following', description: 'SMA crossover with ADX filter for strong trends' },
  { id: 'mean_revert', name: 'Mean Reversion', description: 'RSI oversold/overbought + Bollinger Band bounce' },
  { id: 'momentum', name: 'Momentum', description: 'MACD histogram + volume surge breakout' },
  { id: 'conservative', name: 'Conservative', description: 'High confidence only, tight stops, 1% risk per trade' },
];

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card rounded-lg border border-border p-2.5 sm:p-3">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-mono text-xs sm:text-sm font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-gain' : 'text-loss'}`}>
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
            <th className="text-right py-1.5 px-2 hidden sm:table-cell">Qty</th>
            <th className="text-right py-1.5 px-2">P&L</th>
            <th className="text-right py-1.5 px-2 hidden sm:table-cell">P&L %</th>
            <th className="text-right py-1.5 px-2 hidden md:table-cell">Conf</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
              <td className={`py-1.5 px-2 font-semibold uppercase ${t.side === 'long' ? 'text-gain' : 'text-loss'}`}>{t.side}</td>
              <td className="py-1.5 px-2 text-right font-mono">{t.entryPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono">{t.exitPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono hidden sm:table-cell">{t.quantity}</td>
              <td className={`py-1.5 px-2 text-right font-mono font-semibold ${t.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
              </td>
              <td className={`py-1.5 px-2 text-right font-mono hidden sm:table-cell ${t.pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
              </td>
              <td className="py-1.5 px-2 text-right font-mono hidden md:table-cell">{(t.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestExplainer({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">What is Backtesting?</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          <strong className="text-foreground">Backtesting</strong> simulates a trading strategy on <em>historical data</em> to see how it would have performed — before risking real money.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2 rounded bg-secondary/50 border border-border">
            <span className="text-[10px] font-semibold text-foreground block mb-1">📊 How it works</span>
            <span className="text-[10px]">Replays past candles, generates buy/sell signals using AI + indicators, and tracks simulated P&L.</span>
          </div>
          <div className="p-2 rounded bg-secondary/50 border border-border">
            <span className="text-[10px] font-semibold text-foreground block mb-1">📈 Key Metrics</span>
            <span className="text-[10px]"><b>Sharpe</b> (risk-adj return), <b>Win Rate</b>, <b>Max Drawdown</b>, <b>Profit Factor</b>.</span>
          </div>
        </div>
        <p className="text-[10px] text-warning border-l-2 border-warning/40 pl-2">
          ⚠️ Past performance ≠ future results. Always paper trade first.
        </p>
      </div>
    </div>
  );
}

function getPresetConfig(presetId: string): Partial<BacktestConfig> {
  switch (presetId) {
    case 'trend_follow':
      return { minConfidence: 0.6, stopLossATRMultiplier: 2.5, takeProfitATRMultiplier: 5, maxRiskPerTrade: 0.02 };
    case 'mean_revert':
      return { minConfidence: 0.5, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 3, maxRiskPerTrade: 0.015 };
    case 'momentum':
      return { minConfidence: 0.55, stopLossATRMultiplier: 2, takeProfitATRMultiplier: 4.5, maxRiskPerTrade: 0.025 };
    case 'conservative':
      return { minConfidence: 0.7, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 3, maxRiskPerTrade: 0.01 };
    default:
      return {};
  }
}

export default function BacktestPage() {
  const [assetType, setAssetType] = useState<'crypto' | 'stock'>('crypto');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval_] = useState('1h');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [config, setConfig] = useState<BacktestConfig>({
    initialCapital: 100000,
    maxRiskPerTrade: 0.02,
    minConfidence: 0.55,
    stopLossATRMultiplier: 2,
    takeProfitATRMultiplier: 4,
    commissionPct: 0.001,
  });

  useEffect(() => {
    if (assetType !== 'stock') return;
    (async () => {
      const { data } = await supabase
        .from('watchlist_stocks')
        .select('symbol, name')
        .eq('is_active', true)
        .order('symbol');
      if (data) setStockOptions(data);
    })();
  }, [assetType]);

  const filteredStocks = stockSearch
    ? stockOptions.filter(s => s.symbol.toLowerCase().includes(stockSearch.toLowerCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase())).slice(0, 50)
    : stockOptions.slice(0, 50);

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const presetConfig = getPresetConfig(presetId);
    setConfig(prev => ({
      ...prev,
      ...presetConfig,
    }));
  };

  const handleAddCustomStock = () => {
    const trimmed = customSymbol.trim().toUpperCase();
    if (!trimmed) return;
    setSymbol(trimmed);
    setCustomSymbol('');
  };

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
        const data = await fetchYahooFinanceData(symbol, tf, true);
        candles = data.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      }

      if (candles.length < 80) {
        setError(`Only ${candles.length} candles available. Need at least 80 for backtest. Try a longer interval (1D).`);
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
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 p-2 sm:p-3 overflow-auto pb-20 md:pb-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-sm sm:text-lg font-bold text-foreground">Strategy Backtester</h1>
            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">
              Simulation
            </span>
          </div>
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">What is this?</span>
          </button>
        </div>

        {showExplainer && <BacktestExplainer onClose={() => setShowExplainer(false)} />}

        {/* Strategy Presets */}
        <div className="bg-card rounded-lg border border-border p-2.5 sm:p-3">
          <label className="text-[10px] text-muted-foreground block mb-1.5">Strategy Pattern</label>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-2.5 py-1.5 text-[10px] sm:text-xs rounded-md transition-colors active:scale-[0.97] ${
                  selectedPreset === preset.id
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1.5">
            {STRATEGY_PRESETS.find(p => p.id === selectedPreset)?.description}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-card rounded-lg border border-border p-2.5 sm:p-4">
          <div className="flex flex-wrap items-end gap-2 sm:gap-4">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Asset Type</label>
              <div className="flex gap-1">
                {(['crypto', 'stock'] as const).map(t => (
                  <button key={t} onClick={() => { setAssetType(t); setSymbol(t === 'crypto' ? 'BTCUSDT' : 'RELIANCE'); setStockSearch(''); }}
                    className={`px-2.5 py-1.5 text-[10px] sm:text-xs rounded capitalize transition-colors ${assetType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div className="min-w-[120px] sm:min-w-[140px]">
              <label className="text-[10px] text-muted-foreground block mb-1">Symbol</label>
              {assetType === 'crypto' ? (
                <select value={symbol} onChange={e => setSymbol(e.target.value)}
                  className="bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border w-full">
                  {CRYPTO_PAIRS.map(p => <option key={p.symbol} value={p.symbol}>{p.label}</option>)}
                </select>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-1 bg-secondary rounded border border-border px-2 py-1.5">
                    <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={stockSearch || symbol}
                      onChange={e => { setStockSearch(e.target.value); }}
                      onFocus={() => setStockSearch(symbol)}
                      placeholder="Search stocks..."
                      className="bg-transparent text-[10px] sm:text-xs font-mono text-foreground outline-none w-full"
                    />
                  </div>
                  {stockSearch && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                      {filteredStocks.map(s => (
                        <button key={s.symbol} onClick={() => { setSymbol(s.symbol); setStockSearch(''); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${symbol === s.symbol ? 'bg-accent' : ''}`}>
                          <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                          <span className="text-muted-foreground ml-2 truncate">{s.name}</span>
                        </button>
                      ))}
                      {filteredStocks.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No stocks found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom stock input */}
            {assetType === 'stock' && (
              <div className="min-w-[100px]">
                <label className="text-[10px] text-muted-foreground block mb-1">Custom Symbol</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={customSymbol}
                    onChange={e => setCustomSymbol(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomStock()}
                    placeholder="e.g. TCS"
                    className="bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border w-full"
                  />
                  <button
                    onClick={handleAddCustomStock}
                    className="px-2 py-1.5 text-[10px] bg-primary text-primary-foreground rounded active:scale-95"
                  >
                    Go
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Interval</label>
              <select value={interval} onChange={e => setInterval_(e.target.value)}
                className="bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border">
                {assetType === 'crypto'
                  ? [{ v: '1m', l: '1m' }, { v: '5m', l: '5m' }, { v: '15m', l: '15m' }, { v: '1h', l: '1h' }, { v: '1d', l: '1D' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                  : [{ v: '1h', l: '1H' }, { v: '1d', l: '1D' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                }
              </select>
            </div>

            <button onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs bg-secondary rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Config</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
            </button>

            <button onClick={runTest} disabled={running}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all">
              <Play className="w-3.5 h-3.5" />
              {running ? 'Running...' : 'Run Backtest'}
            </button>
          </div>

          {showConfig && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
              {[
                { key: 'initialCapital', label: 'Capital', step: 10000 },
                { key: 'maxRiskPerTrade', label: 'Max Risk/Trade', step: 0.005, suffix: '%', mult: 100 },
                { key: 'minConfidence', label: 'Min Confidence', step: 0.05, suffix: '%', mult: 100 },
                { key: 'stopLossATRMultiplier', label: 'SL ATR×', step: 0.5 },
                { key: 'takeProfitATRMultiplier', label: 'TP ATR×', step: 0.5 },
                { key: 'commissionPct', label: 'Commission', step: 0.0005, suffix: '%', mult: 100 },
              ].map(({ key, label, step, suffix, mult }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
                  <input type="number" step={step}
                    value={mult ? (config as any)[key] * mult : (config as any)[key]}
                    onChange={e => setConfig({ ...config, [key]: mult ? Number(e.target.value) / mult : Number(e.target.value) })}
                    className="w-full bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-loss/10 border border-loss/20">
            <AlertTriangle className="w-4 h-4 text-loss flex-shrink-0" />
            <span className="text-[10px] sm:text-xs text-loss">{error}</span>
          </div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2">
              <MetricCard label="Total Return" value={`${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toFixed(2)}%`}
                sub={`₹${result.totalReturn.toFixed(0)}`} positive={result.totalReturn >= 0} />
              <MetricCard label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)} positive={result.sharpeRatio > 1} />
              <MetricCard label="Max Drawdown" value={`-${result.maxDrawdownPct.toFixed(2)}%`}
                sub={`₹${result.maxDrawdown.toFixed(0)}`} positive={result.maxDrawdownPct < 15} />
              <MetricCard label="Win Rate" value={`${(result.winRate * 100).toFixed(1)}%`}
                sub={`${result.winningTrades}W / ${result.losingTrades}L`} positive={result.winRate > 0.5} />
              <MetricCard label="Profit Factor" value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)} positive={result.profitFactor > 1.5} />
              <MetricCard label="Calmar Ratio" value={result.calmarRatio.toFixed(2)} positive={result.calmarRatio > 1} />
              <MetricCard label="Avg Win" value={`₹${result.avgWin.toFixed(0)}`} positive={true} />
              <MetricCard label="Avg Loss" value={`₹${result.avgLoss.toFixed(0)}`} positive={false} />
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-3 sm:px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Equity Curve</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{result.totalTrades} trades</span>
              </div>
              <div className="h-44 sm:h-64 md:h-72">
                <EquityChart result={result} />
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-3 sm:px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Trade History</h3>
                <span className="text-[10px] text-muted-foreground">{result.trades.length} trades</span>
              </div>
              <TradesTable trades={result.trades} />
            </div>
          </>
        )}

        {!result && !running && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground py-8 sm:py-12">
            <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" />
            <p className="text-xs sm:text-sm text-center">Configure parameters and run a backtest</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 text-center px-4">Real historical data • Walk-forward signals • Includes commissions</p>
          </div>
        )}
      </div>
    </div>
  );
}
