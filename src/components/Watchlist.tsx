import { useTradingStore } from '@/stores/tradingStore';
import { useEffect } from 'react';

export default function Watchlist() {
  const { watchlist, selectedSymbol, setSelectedSymbol, updateWatchlistPrices } = useTradingStore();

  useEffect(() => {
    const interval = setInterval(updateWatchlistPrices, 2000);
    return () => clearInterval(interval);
  }, [updateWatchlistPrices]);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {watchlist.map(item => (
          <button
            key={item.symbol}
            onClick={() => setSelectedSymbol(item.symbol)}
            className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-border transition-colors hover:bg-accent ${
              selectedSymbol === item.symbol ? 'bg-accent' : ''
            }`}
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">{item.symbol}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  item.type === 'crypto' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
                }`}>
                  {item.type === 'crypto' ? 'CRYPTO' : 'STOCK'}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">{item.name}</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs font-medium text-foreground">
                ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`font-mono text-[11px] font-medium ${item.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
