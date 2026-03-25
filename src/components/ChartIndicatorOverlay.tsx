import { useState } from 'react';
import { BarChart3, ChevronDown, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface IndicatorConfig {
  id: string;
  type: 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'vwap';
  period?: number;
  color: string;
  enabled: boolean;
}

const INDICATOR_PRESETS: { type: IndicatorConfig['type']; label: string; defaultPeriod?: number; color: string }[] = [
  { type: 'sma', label: 'SMA', defaultPeriod: 20, color: '#26c6da' },
  { type: 'ema', label: 'EMA', defaultPeriod: 12, color: '#f59e0b' },
  { type: 'rsi', label: 'RSI (14)', defaultPeriod: 14, color: '#8b5cf6' },
  { type: 'macd', label: 'MACD', color: '#22c55e' },
  { type: 'bollinger', label: 'Bollinger Bands', defaultPeriod: 20, color: '#3b82f6' },
  { type: 'vwap', label: 'VWAP', color: '#ef4444' },
];

interface Props {
  indicators: IndicatorConfig[];
  onToggle: (type: IndicatorConfig['type'], period?: number) => void;
  onRemove: (id: string) => void;
}

export default function ChartIndicatorOverlay({ indicators, onToggle, onRemove }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] sm:text-xs font-mono transition-colors min-h-[32px] active:scale-95 text-muted-foreground hover:text-foreground hover:bg-accent"
        title="Indicators"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Indicators</span>
        {indicators.length > 0 && (
          <span className="bg-primary/20 text-primary text-[9px] px-1 rounded">{indicators.length}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl p-2 w-56"
          style={{ top: 80, right: 16 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-xs font-semibold text-foreground mb-2">Add Indicator</div>
          {INDICATOR_PRESETS.map(preset => {
            const active = indicators.some(i => i.type === preset.type);
            return (
              <button
                key={preset.type}
                onClick={() => { onToggle(preset.type, preset.defaultPeriod); }}
                className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-[11px] font-mono transition-colors active:scale-[0.98] ${
                  active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.color }} />
                  {preset.label}
                </span>
                {active && <span className="text-[9px]">✓</span>}
              </button>
            );
          })}

          {indicators.length > 0 && (
            <>
              <div className="h-px bg-border my-2" />
              <div className="text-[10px] text-muted-foreground mb-1">Active</div>
              {indicators.map(ind => (
                <div key={ind.id} className="flex items-center justify-between px-2 py-1 text-[11px] font-mono">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ind.color }} />
                    {ind.type.toUpperCase()}{ind.period ? ` (${ind.period})` : ''}
                  </span>
                  <button onClick={() => onRemove(ind.id)} className="text-loss hover:bg-loss/10 rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
