import { useState, useEffect, useRef, useCallback } from 'react';
import { useRewardedAd } from '@/hooks/useRewardedAd';
import { createChart, LineSeries, type IChartApi } from 'lightweight-charts';
import TopBar from '@/components/TopBar';
import { fetchKlines } from '@/lib/binanceApi';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { type OHLCV, type BacktestResult, type BacktestConfig, runBacktest } from '@/lib/technicalIndicators';
import { CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, AlertTriangle, Play, Settings, ChevronDown, Info, Search, X, Plus, Save, Trash2, Maximize2, Minimize2 } from 'lucide-react';

interface StockOption { symbol: string; name: string; }

interface StrategyPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<BacktestConfig>;
  isCustom?: boolean;
}

const BUILTIN_PRESETS: StrategyPreset[] = [
  { id: 'default', name: 'AI Ensemble', description: 'RSI + MACD + Bollinger + ADX combined signals', config: {} },
  { id: 'trend_follow', name: 'Trend Following', description: 'SMA crossover with ADX filter for strong trends', config: { minConfidence: 0.6, stopLossATRMultiplier: 2.5, takeProfitATRMultiplier: 5, maxRiskPerTrade: 0.02 } },
  { id: 'mean_revert', name: 'Mean Reversion', description: 'RSI oversold/overbought + Bollinger Band bounce', config: { minConfidence: 0.5, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 3, maxRiskPerTrade: 0.015 } },
  { id: 'momentum', name: 'Momentum', description: 'MACD histogram + volume surge breakout', config: { minConfidence: 0.55, stopLossATRMultiplier: 2, takeProfitATRMultiplier: 4.5, maxRiskPerTrade: 0.025 } },
  { id: 'conservative', name: 'Conservative', description: 'High confidence only, tight stops, 1% risk/trade', config: { minConfidence: 0.7, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 3, maxRiskPerTrade: 0.01 } },
  { id: 'aggressive', name: 'Aggressive', description: 'Lower confidence threshold, wider targets, 3% risk', config: { minConfidence: 0.45, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 6, maxRiskPerTrade: 0.03 } },
  { id: 'scalper', name: 'Scalper', description: 'Tight stops & targets for quick trades, low commission', config: { minConfidence: 0.5, stopLossATRMultiplier: 1, takeProfitATRMultiplier: 2, maxRiskPerTrade: 0.01, commissionPct: 0.0005 } },
];

function loadCustomPresets(): StrategyPreset[] {
  try {
    const stored = localStorage.getItem('custom_backtest_presets');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}
function saveCustomPresets(presets: StrategyPreset[]) {
  localStorage.setItem('custom_backtest_presets', JSON.stringify(presets));
}

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card rounded-lg border border-border p-2.5 sm:p-3">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-mono text-xs sm:text-sm font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-gain' : 'text-loss'}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function EquityChart({ result, fullscreen, onToggleFullscreen }: { result: BacktestResult; fullscreen?: boolean; onToggleFullscreen?: () => void }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const seriesInstance = useRef<any>(null);
  const vMargins = useRef({ top: 0.2, bottom: 0.2 });
  const dataRef = useRef<any[]>([]);

  const zoomRange = (factor: number) => {
    const chart = chartInstance.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const center = (range.from + range.to) / 2;
    const halfSpan = Math.max(10, (range.to - range.from) * factor);
    chart.timeScale().setVisibleLogicalRange({ from: center - halfSpan, to: center + halfSpan });
  };

  useEffect(() => {
    if (!chartRef.current || result.equityCurve.length === 0) return;
    if (chartInstance.current) { chartInstance.current.remove(); chartInstance.current = null; }

    const container = chartRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
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
      rightPriceScale: {
        borderColor: 'hsl(222, 30%, 18%)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'hsl(222, 30%, 18%)',
        timeVisible: true,
        rightOffset: 5,
      },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
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
    dataRef.current = data;
    series.priceScale().applyOptions({ scaleMargins: vMargins.current });
    chart.timeScale().fitContent();
    chartInstance.current = chart;
    seriesInstance.current = series;

    const observer = new ResizeObserver(() => {
      if (container) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    return () => { observer.disconnect(); chart.remove(); chartInstance.current = null; seriesInstance.current = null; };
  }, [result]);

  const zoomIn = () => {
    zoomRange(0.25);
  };

  const zoomOut = () => {
    zoomRange(1);
  };

  const zoomInVertical = () => {
    const chart = chartInstance.current;
    if (!chart) return;
    const scale = chart.priceScale('right');
    scale.applyOptions({ autoScale: false });
    // Shrink margins to zoom in vertically
    const curr = vMargins.current;
    const newTop = Math.min(0.45, curr.top + 0.05);
    const newBottom = Math.min(0.45, curr.bottom + 0.05);
    vMargins.current = { top: newTop, bottom: newBottom };
    seriesInstance.current?.priceScale().applyOptions({
      scaleMargins: vMargins.current,
    });
  };

  const zoomOutVertical = () => {
    const chart = chartInstance.current;
    if (!chart) return;
    const scale = chart.priceScale('right');
    scale.applyOptions({ autoScale: false });
    const curr = vMargins.current;
    const newTop = Math.max(0, curr.top - 0.05);
    const newBottom = Math.max(0, curr.bottom - 0.05);
    vMargins.current = { top: newTop, bottom: newBottom };
    seriesInstance.current?.priceScale().applyOptions({
      scaleMargins: vMargins.current,
    });
  };

  const fitAll = () => {
    const chart = chartInstance.current;
    if (!chart) return;
    chart.priceScale('right').applyOptions({ autoScale: true });
    vMargins.current = { top: 0.2, bottom: 0.2 };
    seriesInstance.current?.priceScale().applyOptions({ scaleMargins: vMargins.current });
    if (dataRef.current.length > 0) {
      chart.timeScale().setVisibleLogicalRange({ from: -1, to: dataRef.current.length });
    }
    requestAnimationFrame(() => {
      chart.priceScale('right').applyOptions({ autoScale: true });
      seriesInstance.current?.priceScale().applyOptions({ scaleMargins: vMargins.current });
    });
  };

  const btnBase = fullscreen
    ? "px-3 py-2 text-sm font-mono bg-card/90 border border-border rounded-lg hover:bg-accent transition-colors text-foreground"
    : "px-2 py-1 text-xs font-mono bg-card/80 border border-border rounded hover:bg-accent transition-colors text-foreground";
  const btnSmall = fullscreen
    ? "px-2.5 py-1.5 text-xs font-mono bg-card/90 border border-border rounded-lg hover:bg-accent transition-colors text-foreground"
    : "px-1.5 py-1 text-[10px] font-mono bg-card/80 border border-border rounded hover:bg-accent transition-colors text-foreground";

  return (
    <div className="relative w-full h-full" style={{ minHeight: '200px' }}>
      <div ref={chartRef} className="w-full h-full touch-none" />
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button onClick={zoomIn} className={btnBase} title="Zoom In">+</button>
        <button onClick={zoomOut} className={btnBase} title="Zoom Out">−</button>
        <button onClick={fitAll} className={btnBase} title="Fit entire chart">Fit</button>
        {onToggleFullscreen && (
          <button onClick={onToggleFullscreen} className={btnBase} title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
        <button onClick={zoomInVertical} className={btnSmall} title="Zoom In (Vertical)">↕+</button>
        <button onClick={zoomOutVertical} className={btnSmall} title="Zoom Out (Vertical)">↕−</button>
      </div>
    </div>
  );
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
        <p><strong className="text-foreground">Backtesting</strong> simulates a trading strategy on <em>historical data</em> to see how it would have performed.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2 rounded bg-secondary/50 border border-border">
            <span className="text-[10px] font-semibold text-foreground block mb-1">📊 How it works</span>
            <span className="text-[10px]">Replays past candles, generates buy/sell signals, and tracks simulated P&L.</span>
          </div>
          <div className="p-2 rounded bg-secondary/50 border border-border">
            <span className="text-[10px] font-semibold text-foreground block mb-1">📈 Key Metrics</span>
            <span className="text-[10px]"><b>Sharpe</b> (risk-adj return), <b>Win Rate</b>, <b>Max Drawdown</b>, <b>Profit Factor</b>.</span>
          </div>
        </div>
        <p className="text-[10px] text-warning border-l-2 border-warning/40 pl-2">⚠️ Past performance ≠ future results. Always paper trade first.</p>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const { gateWithAd: gateBacktest } = useRewardedAd('Backtest');
  const [assetType, setAssetType] = useState<'crypto' | 'stock'>('stock');
  const [symbol, setSymbol] = useState('NIFTY 50');
  const [interval, setInterval_] = useState('1d');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [stockSearch, setStockSearch] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [customSymbol, setCustomSymbol] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [customPresets, setCustomPresets] = useState<StrategyPreset[]>(() => loadCustomPresets());
  const [showCreateStrategy, setShowCreateStrategy] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDesc, setNewStrategyDesc] = useState('');
  const [fullscreenChart, setFullscreenChart] = useState(false);
  const [config, setConfig] = useState<BacktestConfig>({
    initialCapital: 100000,
    maxRiskPerTrade: 0.02,
    minConfidence: 0.55,
    stopLossATRMultiplier: 2,
    takeProfitATRMultiplier: 4,
    commissionPct: 0.001,
  });

  const allPresets = [...BUILTIN_PRESETS, ...customPresets];

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

  const filteredStocks = stockSearch !== null && stockSearch.length > 0
    ? stockOptions.filter(s => s.symbol.toLowerCase().includes(stockSearch.toLowerCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase())).slice(0, 100)
    : stockOptions.slice(0, 100);

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) setConfig(prev => ({ ...prev, ...preset.config }));
  };

  const saveCurrentAsPreset = () => {
    if (!newStrategyName.trim()) return;
    const newPreset: StrategyPreset = {
      id: `custom_${Date.now()}`,
      name: newStrategyName.trim(),
      description: newStrategyDesc.trim() || 'Custom strategy',
      config: { ...config },
      isCustom: true,
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setSelectedPreset(newPreset.id);
    setNewStrategyName('');
    setNewStrategyDesc('');
    setShowCreateStrategy(false);
  };

  const deleteCustomPreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    if (selectedPreset === id) setSelectedPreset('default');
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
        const tf = interval === '1h' ? '1H' : interval === '4h' ? '4H' : interval === '1d' ? '1D' : interval === '1w' ? '1W' : '1D';
        const data = await fetchYahooFinanceData(symbol, tf, true);
        candles = data.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      }
      if (candles.length < 80) {
        setError(`Only ${candles.length} candles available. Need ≥80. Try a longer interval.`);
        setRunning(false);
        return;
      }
      setResult(runBacktest(candles, config));
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  const configFields = [
    { key: 'initialCapital', label: 'Capital (₹)', step: 10000 },
    { key: 'maxRiskPerTrade', label: 'Max Risk/Trade', step: 0.005, mult: 100, suffix: '%' },
    { key: 'minConfidence', label: 'Min Confidence', step: 0.05, mult: 100, suffix: '%' },
    { key: 'stopLossATRMultiplier', label: 'SL ATR×', step: 0.5 },
    { key: 'takeProfitATRMultiplier', label: 'TP ATR×', step: 0.5 },
    { key: 'commissionPct', label: 'Commission', step: 0.0005, mult: 100, suffix: '%' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-2 sm:gap-3 p-2 sm:p-3 overflow-auto pb-20 md:pb-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-sm sm:text-lg font-bold text-foreground">Strategy Backtester</h1>
            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">Simulation</span>
          </div>
          <button onClick={() => setShowExplainer(!showExplainer)} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
            <Info className="w-3.5 h-3.5" /><span className="hidden sm:inline">What is this?</span>
          </button>
        </div>

        {showExplainer && <BacktestExplainer onClose={() => setShowExplainer(false)} />}

        {/* Strategy Presets */}
        <div className="bg-card rounded-lg border border-border p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-muted-foreground">Strategy Pattern</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allPresets.map(preset => (
              <div key={preset.id} className="flex items-center gap-0.5">
                <button
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
                {preset.isCustom && (
                  <button
                    onClick={() => deleteCustomPreset(preset.id)}
                    className="p-1 text-loss/60 hover:text-loss transition-colors"
                    title="Delete custom strategy"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1.5">
            {allPresets.find(p => p.id === selectedPreset)?.description}
          </p>

          {/* Create custom strategy form */}
          {showCreateStrategy && (
            <div className="mt-2 pt-2 border-t border-border space-y-2">
              <p className="text-[10px] text-foreground font-semibold">Save Current Config as Strategy</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newStrategyName}
                  onChange={e => setNewStrategyName(e.target.value)}
                  placeholder="Strategy name"
                  className="bg-secondary text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border"
                />
                <input
                  type="text"
                  value={newStrategyDesc}
                  onChange={e => setNewStrategyDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className="bg-secondary text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveCurrentAsPreset}
                  disabled={!newStrategyName.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded disabled:opacity-50 active:scale-95"
                >
                  <Save className="w-3 h-3" />Save Strategy
                </button>
                <button
                  onClick={() => setShowCreateStrategy(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-card rounded-lg border border-border p-2.5 sm:p-4">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Asset</label>
              <div className="flex gap-1">
                {(['crypto', 'stock'] as const).map(t => (
                  <button key={t} onClick={() => { setAssetType(t); setSymbol(t === 'crypto' ? 'BTCUSDT' : 'NIFTY 50'); setStockSearch(null); }}
                    className={`px-2.5 py-1.5 text-[10px] sm:text-xs rounded capitalize transition-colors ${assetType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div className="min-w-[120px] sm:min-w-[160px]">
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
                      ref={searchInputRef}
                      type="text"
                      value={stockSearch !== null ? stockSearch : symbol}
                      onChange={e => setStockSearch(e.target.value)}
                      onFocus={() => setStockSearch('')}
                      onBlur={() => setTimeout(() => setStockSearch(null), 200)}
                      placeholder="Search 500+ stocks..."
                      className="bg-transparent text-[10px] sm:text-xs font-mono text-foreground outline-none w-full"
                    />
                  </div>
                  {stockSearch !== null && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-56 overflow-y-auto scrollbar-thin">
                      {filteredStocks.map(s => (
                        <button key={s.symbol}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setSymbol(s.symbol); setStockSearch(null); }}
                          className={`w-full text-left px-3 py-1.5 text-[10px] sm:text-xs hover:bg-accent transition-colors ${symbol === s.symbol ? 'bg-accent' : ''}`}>
                          <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                          <span className="text-muted-foreground ml-2">{s.name}</span>
                        </button>
                      ))}
                      {filteredStocks.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No stocks found</div>}
                      <div className="px-3 py-1 text-[9px] text-muted-foreground/40 border-t border-border">{stockOptions.length} stocks available</div>
                    </div>
                  )}
                </div>
              )}
            </div>


            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Interval</label>
              <select value={interval} onChange={e => setInterval_(e.target.value)}
                className="bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border">
                {assetType === 'crypto'
                  ? [{ v: '1m', l: '1m' }, { v: '5m', l: '5m' }, { v: '15m', l: '15m' }, { v: '1h', l: '1H' }, { v: '4h', l: '4H' }, { v: '1d', l: '1D' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                  : [{ v: '1h', l: '1H' }, { v: '4h', l: '4H' }, { v: '1d', l: '1D' }, { v: '1w', l: '1W' }].map(i =>
                    <option key={i.v} value={i.v}>{i.l}</option>)
                }
              </select>
            </div>

            <button onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 px-2 py-1.5 text-[10px] sm:text-xs bg-secondary rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" /><span className="hidden sm:inline">Config</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
            </button>

            <button onClick={() => gateBacktest(runTest)} disabled={running}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all">
              <Play className="w-3.5 h-3.5" />{running ? 'Running...' : 'Run Backtest'}
            </button>
          </div>

          {showConfig && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {configFields.map(({ key, label, step, mult }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
                  <input type="number" step={step}
                    value={mult ? (config as any)[key] * mult : (config as any)[key]}
                    onChange={e => setConfig({ ...config, [key]: mult ? Number(e.target.value) / mult : Number(e.target.value) })}
                    className="w-full bg-secondary text-foreground text-[10px] sm:text-xs font-mono px-2 py-1.5 rounded border border-border" />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-loss/10 border border-loss/20">
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
              <MetricCard label="Avg Win" value={`₹${result.avgWin.toFixed(0)}`} positive />
              <MetricCard label="Avg Loss" value={`₹${result.avgLoss.toFixed(0)}`} positive={false} />
            </div>

            {/* Equity Curve — explicit height container */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="px-3 sm:px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Equity Curve</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{result.totalTrades} trades</span>
              </div>
              <div className="h-[120vh] sm:h-[140vh] lg:h-[160vh]">
                <EquityChart result={result} onToggleFullscreen={() => setFullscreenChart(true)} />
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

      {fullscreenChart && result && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Equity Curve</h3>
              <span className="text-[10px] text-muted-foreground font-mono">{result.totalTrades} trades</span>
            </div>
            <button onClick={() => setFullscreenChart(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-foreground hover:bg-accent transition-colors">
              <Minimize2 className="w-3.5 h-3.5" /> Exit
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <EquityChart result={result} fullscreen onToggleFullscreen={() => setFullscreenChart(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
