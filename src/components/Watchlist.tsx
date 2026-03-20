import { useTradingStore } from '@/stores/tradingStore';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';

export default function Watchlist() {
  const { watchlist, selectedSymbol, setSelectedSymbol, updatePrice } = useTradingStore();
  const [loadingSymbols, setLoadingSymbols] = useState<Set<string>>(new Set());

  // Fetch real prices for all watchlist items on mount
  useEffect(() => {
    const fetchAll = async () => {
      for (const item of watchlist) {
        try {
          setLoadingSymbols(prev => new Set(prev).add(item.symbol));
          const data = await fetchYahooFinanceData(item.symbol, '1D');
          if (data.regularMarketPrice) {
            updatePrice(item.symbol, data.regularMarketPrice, data.previousClose || data.regularMarketPrice);
          }
        } catch (e) {
          console.warn(`Failed to fetch ${item.symbol}:`, e);
        } finally {
          setLoadingSymbols(prev => {
            const next = new Set(prev);
            next.delete(item.symbol);
            return next;
          });
        }
      }
    };
    fetchAll();

    // Refresh every 60 seconds
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
        <span className="text-[10px] text-muted-foreground">NSE</span>
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
              </div>
              <span className="text-[11px] text-muted-foreground">{item.name}</span>
            </div>
            <div className="text-right">
              {item.price === 0 ? (
                <div className="text-xs text-muted-foreground animate-pulse">Loading...</div>
              ) : (
                <>
                  <div className="font-mono text-xs font-medium text-foreground">
                    ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`font-mono text-[11px] font-medium ${item.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
