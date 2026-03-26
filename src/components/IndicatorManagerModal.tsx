import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Settings2, Eye, EyeOff, Trash2, BarChart3, ChevronRight } from 'lucide-react';
import type { IndicatorConfig } from '@/components/ChartIndicatorOverlay';

const INDICATOR_LIBRARY = [
  { type: 'sma' as const, label: 'Simple Moving Average', shortLabel: 'SMA', defaultPeriod: 20, color: '#26c6da', category: 'Trend' },
  { type: 'ema' as const, label: 'Exponential Moving Average', shortLabel: 'EMA', defaultPeriod: 12, color: '#f59e0b', category: 'Trend' },
  { type: 'bollinger' as const, label: 'Bollinger Bands', shortLabel: 'BB', defaultPeriod: 20, color: '#3b82f6', category: 'Volatility' },
  { type: 'rsi' as const, label: 'Relative Strength Index', shortLabel: 'RSI', defaultPeriod: 14, color: '#8b5cf6', category: 'Oscillator' },
  { type: 'macd' as const, label: 'MACD', shortLabel: 'MACD', color: '#22c55e', category: 'Oscillator' },
  { type: 'vwap' as const, label: 'Volume Weighted Avg Price', shortLabel: 'VWAP', color: '#ef4444', category: 'Volume' },
];

const CATEGORIES = ['All', 'Trend', 'Oscillator', 'Volatility', 'Volume'];

interface Props {
  open: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onToggle: (type: IndicatorConfig['type'], period?: number) => void;
  onRemove: (id: string) => void;
}

export default function IndicatorManagerModal({ open, onClose, indicators, onToggle, onRemove }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

  if (!open) return null;

  const filtered = INDICATOR_LIBRARY.filter(ind => {
    const matchSearch = ind.label.toLowerCase().includes(search.toLowerCase()) || ind.shortLabel.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || ind.category === category;
    return matchSearch && matchCat;
  });

  const settingsIndicator = settingsFor ? indicators.find(i => i.id === settingsFor) : null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 fade-in duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Indicators</h2>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">{indicators.length} active</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 sm:px-5 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search indicators..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-secondary/50 border border-border/30 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto scrollbar-thin">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                category === cat
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Indicator list */}
        <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
          <div className="space-y-1">
            {filtered.map(ind => {
              const isActive = indicators.some(i => i.type === ind.type);
              return (
                <button
                  key={ind.type}
                  onClick={() => onToggle(ind.type, ind.defaultPeriod)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent/30 border border-transparent'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ind.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{ind.label}</div>
                    <div className="text-[10px] text-muted-foreground">{ind.category}{ind.defaultPeriod ? ` · Period ${ind.defaultPeriod}` : ''}</div>
                  </div>
                  {isActive && (
                    <span className="text-[9px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active indicators */}
        {indicators.length > 0 && (
          <div className="border-t border-border/30 px-5 py-3 space-y-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Indicators</div>
            <div className="space-y-1">
              {indicators.map(ind => (
                <div key={ind.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent/20 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                    <span className="text-[11px] font-mono font-medium text-foreground">
                      {ind.type.toUpperCase()}{ind.period ? ` (${ind.period})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSettingsFor(ind.id); }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Settings"
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(ind.id); }}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
