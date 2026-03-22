import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, LineSeries, type IChartApi } from 'lightweight-charts';
import TopBar from '@/components/TopBar';
import { fetchKlines } from '@/lib/binanceApi';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { type OHLCV } from '@/lib/technicalIndicators';
import { CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { supabase } from '@/integrations/supabase/client';
import {
  type StrategyDefinition, type StrategyResult, type RuleCondition,
  type IndicatorConfig, type IndicatorType, type ConditionSource, type ConditionOperator,
  DEFAULT_INDICATOR_PARAMS, STRATEGY_TEMPLATES,
  runCustomStrategy, exportTradesCSV,
} from '@/lib/strategyEngine';
import {
  Play, Settings, Search, Plus, Trash2, Maximize2, Minimize2,
  Download, ChevronDown, ChevronRight, Save, RotateCcw, Layers, Target,
  TrendingUp, TrendingDown, BarChart3, AlertTriangle, ArrowUpDown, Copy,
} from 'lucide-react';

// ============ Sub-Components ============

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card rounded-lg border border-border p-2.5">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-mono text-xs font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-gain' : 'text-loss'}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function LWChart({ data, color, label, height }: { data: { time: number; value: number }[]; color: string; label: string; height: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
      layout: { background: { color: 'hsl(222, 47%, 5%)' }, textColor: 'hsl(215, 15%, 50%)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 },
      grid: { vertLines: { color: 'hsl(222, 30%, 12%)' }, horzLines: { color: 'hsl(222, 30%, 12%)' } },
      rightPriceScale: { borderColor: 'hsl(222, 30%, 18%)' },
      timeScale: { borderColor: 'hsl(222, 30%, 18%)', timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    const series = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false });
    const step = Math.max(1, Math.floor(data.length / 500));
    series.setData(data.filter((_, i) => i % step === 0).map(d => ({ time: d.time as any, value: d.value })));
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const obs = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight });
    });
    obs.observe(ref.current);
    return () => { obs.disconnect(); chart.remove(); chartRef.current = null; };
  }, [data, color]);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-1.5 bg-panel-header border-b border-border flex items-center gap-2">
        <TrendingUp className="w-3 h-3 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
      </div>
      <div style={{ height }} ref={ref} className="w-full" />
    </div>
  );
}

const SOURCES: { value: ConditionSource; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'ema1', label: 'EMA 1' },
  { value: 'ema2', label: 'EMA 2' },
  { value: 'sma1', label: 'SMA 1' },
  { value: 'sma2', label: 'SMA 2' },
  { value: 'rsi', label: 'RSI' },
  { value: 'macd_line', label: 'MACD Line' },
  { value: 'macd_signal', label: 'MACD Signal' },
  { value: 'macd_histogram', label: 'MACD Hist' },
  { value: 'bb_upper', label: 'BB Upper' },
  { value: 'bb_lower', label: 'BB Lower' },
  { value: 'bb_middle', label: 'BB Middle' },
  { value: 'value', label: 'Value' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: 'crosses_above', label: 'Crosses Above' },
  { value: 'crosses_below', label: 'Crosses Below' },
];

function ConditionRow({ condition, onChange, onRemove }: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-secondary/50 rounded-md border border-border/50">
      <select value={condition.left} onChange={e => onChange({ ...condition, left: e.target.value as ConditionSource })}
        className="bg-background text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border min-w-[70px]">
        {SOURCES.filter(s => s.value !== 'value').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value as ConditionOperator })}
        className="bg-background text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border">
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={condition.right} onChange={e => onChange({ ...condition, right: e.target.value as ConditionSource })}
        className="bg-background text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border min-w-[70px]">
        {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {condition.right === 'value' && (
        <input type="number" value={condition.rightValue ?? 0}
          onChange={e => onChange({ ...condition, rightValue: Number(e.target.value) })}
          className="bg-background text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border w-16" />
      )}
      <button onClick={onRemove} className="p-1 text-loss/60 hover:text-loss"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function IndicatorBadge({ config, onRemove }: { config: IndicatorConfig; onRemove: () => void }) {
  const params = Object.entries(config.params).map(([k, v]) => `${k}=${v}`).join(', ');
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-mono border border-primary/20">
      <Layers className="w-3 h-3" />
      <span>{config.type}({params})</span>
      <button onClick={onRemove} className="ml-1 text-primary/50 hover:text-loss"><Trash2 className="w-2.5 h-2.5" /></button>
    </div>
  );
}

// ============ Main Page ============

export default function StrategyBuilderPage() {
  // Strategy state
  const [strategy, setStrategy] = useState<StrategyDefinition>({ ...STRATEGY_TEMPLATES[0] });
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Asset selection
  const [symbol, setSymbol] = useState('NIFTY 50');
  const [interval, setInterval_] = useState('1d');
  const [stockOptions, setStockOptions] = useState<{ symbol: string; name: string }[]>([]);
  const [stockSearch, setStockSearch] = useState<string | null>(null);

  // UI state
  const [addIndicatorOpen, setAddIndicatorOpen] = useState(false);
  const [newIndType, setNewIndType] = useState<IndicatorType>('EMA');
  const [newIndParams, setNewIndParams] = useState<Record<string, number>>({ ...DEFAULT_INDICATOR_PARAMS.EMA });
  const [fullscreenChart, setFullscreenChart] = useState<'equity' | 'drawdown' | null>(null);
  const [savedStrategies, setSavedStrategies] = useState<StrategyDefinition[]>(() => {
    try { return JSON.parse(localStorage.getItem('saved_strategies') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (strategy.market !== 'stocks') return;
    (async () => {
      const { data } = await supabase.from('watchlist_stocks').select('symbol, name').eq('is_active', true).order('symbol');
      if (data) setStockOptions(data);
    })();
  }, [strategy.market]);

  const filteredStocks = stockSearch !== null && stockSearch.length > 0
    ? stockOptions.filter(s => s.symbol.toLowerCase().includes(stockSearch.toLowerCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase())).slice(0, 80)
    : stockOptions.slice(0, 80);

  const updateStrategy = useCallback((partial: Partial<StrategyDefinition>) => {
    setStrategy(prev => ({ ...prev, ...partial }));
  }, []);

  const addIndicator = () => {
    updateStrategy({ indicators: [...strategy.indicators, { type: newIndType, params: { ...newIndParams } }] });
    setAddIndicatorOpen(false);
  };

  const removeIndicator = (idx: number) => {
    updateStrategy({ indicators: strategy.indicators.filter((_, i) => i !== idx) });
  };

  const addCondition = (type: 'entry' | 'exit') => {
    const newCond: RuleCondition = { id: Date.now().toString(), left: 'price', operator: '>', right: 'sma1' };
    if (type === 'entry') updateStrategy({ entryConditions: [...strategy.entryConditions, newCond] });
    else updateStrategy({ exitConditions: [...strategy.exitConditions, newCond] });
  };

  const updateCondition = (type: 'entry' | 'exit', idx: number, cond: RuleCondition) => {
    const arr = type === 'entry' ? [...strategy.entryConditions] : [...strategy.exitConditions];
    arr[idx] = cond;
    if (type === 'entry') updateStrategy({ entryConditions: arr });
    else updateStrategy({ exitConditions: arr });
  };

  const removeCondition = (type: 'entry' | 'exit', idx: number) => {
    if (type === 'entry') updateStrategy({ entryConditions: strategy.entryConditions.filter((_, i) => i !== idx) });
    else updateStrategy({ exitConditions: strategy.exitConditions.filter((_, i) => i !== idx) });
  };

  const loadTemplate = (template: StrategyDefinition) => {
    setStrategy({ ...template });
    setSymbol(template.market === 'crypto' ? 'BTCUSDT' : 'NIFTY 50');
    setResult(null);
  };

  const saveStrategy = () => {
    const updated = [...savedStrategies.filter(s => s.name !== strategy.name), { ...strategy }];
    setSavedStrategies(updated);
    localStorage.setItem('saved_strategies', JSON.stringify(updated));
  };

  const deleteStrategy = (name: string) => {
    const updated = savedStrategies.filter(s => s.name !== name);
    setSavedStrategies(updated);
    localStorage.setItem('saved_strategies', JSON.stringify(updated));
  };

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      let candles: OHLCV[];
      if (strategy.market === 'crypto') {
        const raw = await fetchKlines(symbol, interval, 1000);
        candles = raw.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      } else {
        const tf = interval === '1h' ? '1H' : interval === '4h' ? '4H' : interval === '1d' ? '1D' : interval === '1w' ? '1W' : '1D';
        const data = await fetchYahooFinanceData(symbol, tf, true);
        candles = data.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      }
      if (candles.length < 80) {
        setError(`Only ${candles.length} candles. Need ≥80 for analysis.`);
        setRunning(false);
        return;
      }
      setResult(runCustomStrategy(candles, strategy));
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  const downloadCSV = () => {
    if (!result) return;
    const csv = exportTradesCSV(result.trades);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategy.name.replace(/\s+/g, '_')}_trades.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fullscreen overlay
  if (fullscreenChart && result) {
    const isEquity = fullscreenChart === 'equity';
    const data = isEquity ? result.equityCurve.map(e => ({ time: e.time, value: e.equity })) : result.drawdownCurve.map(d => ({ time: d.time, value: d.drawdown }));
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{isEquity ? 'Equity Curve' : 'Drawdown'}</h3>
          </div>
          <button onClick={() => setFullscreenChart(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-secondary text-foreground hover:bg-accent">
            <Minimize2 className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <LWChart data={data} color={isEquity ? (result.totalReturn >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)') : 'hsl(0, 72%, 51%)'} label="" height="100%" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80 lg:w-96' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border bg-card flex-shrink-0`}>
          <div className="h-full overflow-y-auto p-3 space-y-3 pb-20 md:pb-3 scrollbar-thin">
            {/* Strategy Name */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Strategy Name</label>
              <input type="text" value={strategy.name} onChange={e => updateStrategy({ name: e.target.value })}
                className="w-full bg-secondary text-foreground text-xs font-mono px-2.5 py-1.5 rounded border border-border" />
            </div>

            {/* Templates */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1.5">Templates</label>
              <div className="flex flex-wrap gap-1">
                {STRATEGY_TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => loadTemplate(t)}
                    className={`px-2 py-1 text-[10px] rounded transition-colors ${strategy.name === t.name ? 'bg-primary text-primary-foreground font-semibold' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
              {savedStrategies.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {savedStrategies.map(s => (
                    <div key={s.name} className="flex items-center gap-0.5">
                      <button onClick={() => loadTemplate(s)}
                        className="px-2 py-1 text-[10px] rounded bg-accent text-foreground hover:bg-accent/80">
                        {s.name}
                      </button>
                      <button onClick={() => deleteStrategy(s.name)} className="p-0.5 text-loss/50 hover:text-loss"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market & Asset */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Market</label>
                <div className="flex gap-1">
                  {(['crypto', 'stocks'] as const).map(m => (
                    <button key={m} onClick={() => { updateStrategy({ market: m }); setSymbol(m === 'crypto' ? 'BTCUSDT' : 'NIFTY 50'); }}
                      className={`flex-1 px-2 py-1.5 text-[10px] rounded capitalize ${strategy.market === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Asset</label>
                {strategy.market === 'crypto' ? (
                  <select value={symbol} onChange={e => setSymbol(e.target.value)}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-2 py-1.5 rounded border border-border">
                    {CRYPTO_PAIRS.map(p => <option key={p.symbol} value={p.symbol}>{p.label}</option>)}
                  </select>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-1 bg-secondary rounded border border-border px-2 py-1.5">
                      <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <input type="text"
                        value={stockSearch !== null ? stockSearch : symbol}
                        onChange={e => setStockSearch(e.target.value)}
                        onFocus={() => setStockSearch('')}
                        onBlur={() => setTimeout(() => setStockSearch(null), 200)}
                        placeholder="Search stocks..."
                        className="bg-transparent text-[10px] font-mono text-foreground outline-none w-full" />
                    </div>
                    {stockSearch !== null && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                        {filteredStocks.map(s => (
                          <button key={s.symbol} onMouseDown={e => e.preventDefault()}
                            onClick={() => { setSymbol(s.symbol); setStockSearch(null); }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-accent ${symbol === s.symbol ? 'bg-accent' : ''}`}>
                            <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                            <span className="text-muted-foreground ml-2">{s.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Timeframe</label>
                <select value={interval} onChange={e => setInterval_(e.target.value)}
                  className="w-full bg-secondary text-foreground text-[10px] font-mono px-2 py-1.5 rounded border border-border">
                  {(strategy.market === 'crypto'
                    ? [{ v: '1m', l: '1m' }, { v: '5m', l: '5m' }, { v: '15m', l: '15m' }, { v: '1h', l: '1H' }, { v: '4h', l: '4H' }, { v: '1d', l: '1D' }]
                    : [{ v: '1h', l: '1H' }, { v: '4h', l: '4H' }, { v: '1d', l: '1D' }, { v: '1w', l: '1W' }]
                  ).map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
                </select>
              </div>
            </div>

            {/* Indicators */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Indicators
                </label>
                <button onClick={() => setAddIndicatorOpen(!addIndicatorOpen)} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {strategy.indicators.map((ind, i) => (
                  <IndicatorBadge key={i} config={ind} onRemove={() => removeIndicator(i)} />
                ))}
              </div>
              {addIndicatorOpen && (
                <div className="mt-2 p-2 bg-secondary/50 rounded-md border border-border space-y-2">
                  <select value={newIndType} onChange={e => {
                    const t = e.target.value as IndicatorType;
                    setNewIndType(t);
                    setNewIndParams({ ...DEFAULT_INDICATOR_PARAMS[t] });
                  }} className="w-full bg-background text-foreground text-[10px] font-mono px-2 py-1.5 rounded border border-border">
                    {(['EMA', 'SMA', 'RSI', 'MACD', 'BollingerBands', 'ATR'] as IndicatorType[]).map(t =>
                      <option key={t} value={t}>{t}</option>
                    )}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(newIndParams).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1">
                        <label className="text-[9px] text-muted-foreground">{key}</label>
                        <input type="number" value={val}
                          onChange={e => setNewIndParams({ ...newIndParams, [key]: Number(e.target.value) })}
                          className="bg-background text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border w-14" />
                      </div>
                    ))}
                  </div>
                  <button onClick={addIndicator} className="w-full px-2 py-1.5 text-[10px] bg-primary text-primary-foreground rounded font-semibold">
                    Add {newIndType}
                  </button>
                </div>
              )}
            </div>

            {/* Entry Conditions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-gain" /> Entry Conditions
                </label>
                <button onClick={() => addCondition('entry')} className="text-[10px] text-gain hover:text-gain/80 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1">
                {strategy.entryConditions.map((c, i) => (
                  <ConditionRow key={c.id} condition={c}
                    onChange={cond => updateCondition('entry', i, cond)}
                    onRemove={() => removeCondition('entry', i)} />
                ))}
                {strategy.entryConditions.length === 0 && (
                  <p className="text-[9px] text-muted-foreground/50 italic">No entry conditions defined</p>
                )}
              </div>
            </div>

            {/* Exit Conditions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-loss" /> Exit Conditions
                </label>
                <button onClick={() => addCondition('exit')} className="text-[10px] text-loss hover:text-loss/80 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-1">
                {strategy.exitConditions.map((c, i) => (
                  <ConditionRow key={c.id} condition={c}
                    onChange={cond => updateCondition('exit', i, cond)}
                    onRemove={() => removeCondition('exit', i)} />
                ))}
                {strategy.exitConditions.length === 0 && (
                  <p className="text-[9px] text-muted-foreground/50 italic">No exit conditions defined</p>
                )}
              </div>
            </div>

            {/* Risk Management */}
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Target className="w-3 h-3" /> Risk Management
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Stop Loss</label>
                  <select value={strategy.stopLoss.type} onChange={e => updateStrategy({ stopLoss: { ...strategy.stopLoss, type: e.target.value as any } })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border mb-1">
                    <option value="percentage">% Based</option>
                    <option value="atr">ATR ×</option>
                  </select>
                  <input type="number" step={0.5} value={strategy.stopLoss.value}
                    onChange={e => updateStrategy({ stopLoss: { ...strategy.stopLoss, value: Number(e.target.value) } })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Take Profit</label>
                  <select value={strategy.takeProfit.type} onChange={e => updateStrategy({ takeProfit: { ...strategy.takeProfit, type: e.target.value as any } })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border mb-1">
                    <option value="percentage">% Based</option>
                    <option value="rr_ratio">R:R Ratio</option>
                  </select>
                  <input type="number" step={0.5} value={strategy.takeProfit.value}
                    onChange={e => updateStrategy({ takeProfit: { ...strategy.takeProfit, value: Number(e.target.value) } })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Capital (₹)</label>
                  <input type="number" step={10000} value={strategy.initialCapital}
                    onChange={e => updateStrategy({ initialCapital: Number(e.target.value) })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Size %</label>
                  <input type="number" step={1} value={strategy.positionSizePct}
                    onChange={e => updateStrategy({ positionSizePct: Number(e.target.value) })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground block mb-0.5">Fee %</label>
                  <input type="number" step={0.001} value={strategy.commissionPct * 100}
                    onChange={e => updateStrategy({ commissionPct: Number(e.target.value) / 100 })}
                    className="w-full bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1 rounded border border-border" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <button onClick={runTest} disabled={running || strategy.entryConditions.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 active:scale-[0.97]">
                <Play className="w-3.5 h-3.5" />{running ? 'Running...' : 'Run Backtest'}
              </button>
              <button onClick={saveStrategy} className="px-3 py-2 text-xs rounded bg-secondary text-foreground hover:bg-accent border border-border" title="Save Strategy">
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-auto pb-20 md:pb-0">
          {/* Sidebar Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
              {sidebarOpen ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="text-xs font-semibold text-foreground">{strategy.name}</span>
            <span className="text-[10px] text-muted-foreground">• {symbol} • {interval}</span>
            {result && (
              <span className={`text-[10px] font-mono font-semibold ml-auto ${result.totalReturn >= 0 ? 'text-gain' : 'text-loss'}`}>
                {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 m-3 rounded-lg bg-loss/10 border border-loss/20">
              <AlertTriangle className="w-4 h-4 text-loss flex-shrink-0" />
              <span className="text-[10px] text-loss">{error}</span>
            </div>
          )}

          {result ? (
            <div className="p-3 space-y-3">
              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
                <MetricCard label="Total Return" value={`${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toFixed(2)}%`}
                  sub={`₹${result.totalReturn.toFixed(0)}`} positive={result.totalReturn >= 0} />
                <MetricCard label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)} positive={result.sharpeRatio > 1} />
                <MetricCard label="Max Drawdown" value={`-${result.maxDrawdownPct.toFixed(2)}%`}
                  sub={`₹${result.maxDrawdown.toFixed(0)}`} positive={result.maxDrawdownPct < 15} />
                <MetricCard label="Win Rate" value={`${(result.winRate * 100).toFixed(1)}%`}
                  sub={`${result.winningTrades}W / ${result.losingTrades}L`} positive={result.winRate > 0.5} />
                <MetricCard label="Profit Factor" value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)} positive={result.profitFactor > 1.5} />
                <MetricCard label="Total Trades" value={result.totalTrades.toString()} />
                <MetricCard label="Avg Win" value={`₹${result.avgWin.toFixed(0)}`} positive />
                <MetricCard label="Avg Loss" value={`₹${result.avgLoss.toFixed(0)}`} positive={false} />
              </div>

              {/* Equity Curve */}
              <div className="relative">
                <LWChart
                  data={result.equityCurve.map(e => ({ time: e.time, value: e.equity }))}
                  color={result.totalReturn >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'}
                  label={`Equity Curve — ${result.totalTrades} trades`}
                  height="350px"
                />
                <button onClick={() => setFullscreenChart('equity')}
                  className="absolute top-2 right-2 p-1.5 bg-card/80 border border-border rounded hover:bg-accent z-10">
                  <Maximize2 className="w-3.5 h-3.5 text-foreground" />
                </button>
              </div>

              {/* Drawdown */}
              <div className="relative">
                <LWChart
                  data={result.drawdownCurve.map(d => ({ time: d.time, value: d.drawdown }))}
                  color="hsl(0, 72%, 51%)"
                  label="Drawdown %"
                  height="200px"
                />
                <button onClick={() => setFullscreenChart('drawdown')}
                  className="absolute top-2 right-2 p-1.5 bg-card/80 border border-border rounded hover:bg-accent z-10">
                  <Maximize2 className="w-3.5 h-3.5 text-foreground" />
                </button>
              </div>

              {/* Trade Log */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-panel-header border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    <h3 className="text-xs font-semibold text-foreground">Trade Log</h3>
                    <span className="text-[10px] text-muted-foreground">{result.trades.length} trades</span>
                  </div>
                  <button onClick={downloadCSV} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="overflow-auto max-h-80 scrollbar-thin">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5 px-2">#</th>
                        <th className="text-right py-1.5 px-2">Entry</th>
                        <th className="text-right py-1.5 px-2">Exit</th>
                        <th className="text-right py-1.5 px-2 hidden sm:table-cell">Qty</th>
                        <th className="text-right py-1.5 px-2">P&L</th>
                        <th className="text-right py-1.5 px-2">P&L %</th>
                        <th className="text-right py-1.5 px-2 hidden md:table-cell">Duration</th>
                        <th className="text-right py-1.5 px-2 hidden lg:table-cell">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.entryPrice.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.exitPrice.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right font-mono hidden sm:table-cell">{t.quantity}</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${t.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                          </td>
                          <td className={`py-1.5 px-2 text-right font-mono ${t.pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono hidden md:table-cell text-muted-foreground">{t.duration} bars</td>
                          <td className="py-1.5 px-2 text-right hidden lg:table-cell">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              t.exitReason === 'take_profit' ? 'bg-gain/10 text-gain' :
                              t.exitReason === 'stop_loss' ? 'bg-loss/10 text-loss' :
                              'bg-secondary text-muted-foreground'
                            }`}>
                              {t.exitReason.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <Layers className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="text-sm">Build your strategy in the sidebar</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Define indicators, entry/exit rules, then run backtest</p>
              </div>
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-primary-foreground rounded hover:opacity-90">
                  <Settings className="w-3.5 h-3.5" /> Open Strategy Builder
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
