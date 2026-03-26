import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopPerformers() {
  const { watchlist, setSelectedSymbol } = useTradingStore();
  const navigate = useNavigate();

  const withPrices = watchlist.filter(w => w.price > 0);
  if (withPrices.length === 0) return null;

  const sorted = [...withPrices].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter(s => s.changePercent > 0).slice(0, 5);
  const losers = [...sorted].reverse().filter(s => s.changePercent < 0).slice(0, 5);

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <div className="space-y-2">
      {gainers.length > 0 && (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
          <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-border/30">
            <TrendingUp className="w-3.5 h-3.5 text-gain" />
            <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Watchlist ↑</span>
            <span className="text-[9px] text-muted-foreground font-mono ml-auto">Your Picks</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
            {gainers.map(s => (
              <button
                key={s.symbol}
                onClick={() => navigate('/charts', { state: { mode: 'stocks', symbol: s.symbol } })}
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
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
          <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-border/30">
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
            <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Watchlist ↓</span>
            <span className="text-[9px] text-muted-foreground font-mono ml-auto">Your Picks</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
            {losers.map(s => (
              <button
                key={s.symbol}
                onClick={() => navigate('/charts', { state: { mode: 'stocks', symbol: s.symbol } })}
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
