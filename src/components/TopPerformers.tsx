import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function TopPerformers() {
  const { watchlist, setSelectedSymbol } = useTradingStore();

  const withPrices = watchlist.filter(w => w.price > 0);
  if (withPrices.length === 0) return null;

  const sorted = [...withPrices].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter(s => s.changePercent > 0).slice(0, 5);
  const losers = [...sorted].reverse().filter(s => s.changePercent < 0).slice(0, 5);

  return (
    <div className="space-y-2">
      {gainers.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-2">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <TrendingUp className="w-3.5 h-3.5 text-gain" />
            <span className="text-[11px] font-semibold text-foreground">Top Gainers</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {gainers.map(s => (
              <button
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className="flex-shrink-0 bg-gain/5 border border-gain/20 rounded-lg px-3 py-2 min-w-[100px] text-left active:scale-95 transition-transform"
              >
                <div className="font-mono text-[11px] font-semibold text-foreground truncate">{s.symbol}</div>
                <div className="font-mono text-[10px] text-foreground">₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</div>
                <div className="font-mono text-[10px] font-medium text-gain">+{s.changePercent.toFixed(2)}%</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-2">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
            <span className="text-[11px] font-semibold text-foreground">Top Losers</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {losers.map(s => (
              <button
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className="flex-shrink-0 bg-loss/5 border border-loss/20 rounded-lg px-3 py-2 min-w-[100px] text-left active:scale-95 transition-transform"
              >
                <div className="font-mono text-[11px] font-semibold text-foreground truncate">{s.symbol}</div>
                <div className="font-mono text-[10px] text-foreground">₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</div>
                <div className="font-mono text-[10px] font-medium text-loss">{s.changePercent.toFixed(2)}%</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
