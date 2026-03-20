import { useTradingStore } from '@/stores/tradingStore';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { Search } from 'lucide-react';

export default function Watchlist() {
  const { watchlist, selectedSymbol, setSelectedSymbol, updatePrice, loadWatchlistFromDB, watchlistLoaded } = useTradingStore();
  const [search, setSearch] = useState('');
  const [loadingSymbols, setLoadingSymbols] = useState<Set<string>>(new Set());

  // Load watchlist from DB on mount
  useEffect(() => {
    if (!watchlistLoaded) loadWatchlistFromDB();
  }, [watchlistLoaded]);

  // Fetch real prices for visible items
  useEffect(() => {
    if (watchlist.length === 0) return;

    const fetchAll = async () => {
      // Fetch in batches of 5 to avoid overwhelming
      for (let i = 0; i < watchlist.length; i += 5) {
        const batch = watchlist.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (item) => {
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
          })
        );
      }
    };
    fetchAll();

    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [watchlist.length]);

  const filtered = search
    ? watchlist.filter(i => i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()))
    : watchlist;

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
        <span className="text-[10px] text-muted-foreground">{watchlist.length} NSE</span>
      </div>
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 bg-secondary rounded px-2 py-1">
          <Search className="w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.map(item => (
          <button
            key={item.symbol}
            onClick={() => setSelectedSymbol(item.symbol)}
            className={`w-full flex items-center justify-between px-4 py-2 border-b border-border transition-colors hover:bg-accent ${
              selectedSymbol === item.symbol ? 'bg-accent' : ''
            }`}
          >
            <div className="text-left min-w-0">
              <div className="font-mono text-xs font-semibold text-foreground truncate">{item.symbol}</div>
              <span className="text-[10px] text-muted-foreground truncate block">{item.name}</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              {item.price === 0 ? (
                <div className="text-[10px] text-muted-foreground animate-pulse">...</div>
              ) : (
                <>
                  <div className="font-mono text-[11px] font-medium text-foreground">
                    ₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`font-mono text-[10px] font-medium ${item.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">No stocks found</div>
        )}
      </div>
    </div>
  );
}
