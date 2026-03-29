import { useTradingStore } from '@/stores/tradingStore';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const MARKETS = [
  { value: 'IN' as const, flag: '🇮🇳', label: 'NSE', full: 'Indian Market' },
  { value: 'US' as const, flag: '🇺🇸', label: 'NYSE', full: 'US Market' },
];

export default function MarketRegionToggle() {
  const { marketRegion, setMarketRegion } = useTradingStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = MARKETS.find(m => m.value === marketRegion) || MARKETS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border/50 hover:bg-secondary transition-all active:scale-95"
        style={{ minHeight: 36 }}
      >
        <span className="text-sm leading-none">{selected.flag}</span>
        <span className="text-[10px] font-mono font-bold text-foreground">{selected.label}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {MARKETS.map(m => (
            <button
              key={m.value}
              onClick={() => { setMarketRegion(m.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                marketRegion === m.value ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-accent'
              }`}
              style={{ minHeight: 44 }}
            >
              <span className="text-base">{m.flag}</span>
              <div>
                <div className="text-[11px] font-mono font-bold">{m.label}</div>
                <div className="text-[9px] text-muted-foreground">{m.full}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
