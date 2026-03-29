import { useTradingStore } from '@/stores/tradingStore';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { getUsdToInrRate } from '@/lib/exchangeRate';
import { Search, X, Star, BookmarkPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface MasterStock {
  symbol: string;
  name: string;
  yahoo_symbol: string;
  stock_type: string;
}


const INDIAN_INDICES = ['^NSEI', '^BSESN', '^NSEBANK'];
const isIndianSymbol = (yahooSymbol?: string) => {
  if (!yahooSymbol) return false;
  return yahooSymbol.endsWith('.NS') || yahooSymbol.endsWith('.BO') || INDIAN_INDICES.includes(yahooSymbol);
};

export default function Watchlist() {
  const { watchlist, selectedSymbol, setSelectedSymbol, updatePrice, loadUserWatchlist, watchlistLoaded, marketRegion } = useTradingStore();
  const [search, setSearch] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [masterStocks, setMasterStocks] = useState<MasterStock[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [userSymbols, setUserSymbols] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [usdToInr, setUsdToInr] = useState<number>(85.5);

  useEffect(() => {
    if (!watchlistLoaded) loadUserWatchlist();
  }, [watchlistLoaded]);

  useEffect(() => {
    setUserSymbols(new Set(watchlist.map(w => w.symbol)));
  }, [watchlist]);

  // Load live USD→INR rate
  useEffect(() => {
    getUsdToInrRate().then(setUsdToInr);
    const id = setInterval(() => getUsdToInrRate().then(setUsdToInr), 60000);
    return () => clearInterval(id);
  }, []);

  // Fetch prices
  useEffect(() => {
    if (watchlist.length === 0) return;
    const fetchAll = async () => {
      for (let i = 0; i < watchlist.length; i += 5) {
        const batch = watchlist.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              const data = await fetchYahooFinanceData(item.symbol, '1D');
              if (data.regularMarketPrice) {
                updatePrice(item.symbol, data.regularMarketPrice, data.previousClose || data.regularMarketPrice);
              }
            } catch (e) {
              console.warn(`Failed to fetch ${item.symbol}:`, e);
            }
          })
        );
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [watchlist.length]);

  // Load master stocks filtered by market region when modal opens
  useEffect(() => {
    if (!showSearchModal) return;
    (async () => {
      const isIndian = marketRegion === 'IN';
      const { data } = await supabase
        .from('watchlist_stocks')
        .select('symbol, name, yahoo_symbol, stock_type')
        .eq('is_active', true)
        .order('symbol');
      if (data) {
        // Filter master stocks by region: Indian stocks have .NS or .BO suffix in yahoo_symbol
        const filtered = data.filter(s => {
          const isIndianStock = isIndianSymbol(s.yahoo_symbol);
          return isIndian ? isIndianStock : !isIndianStock;
        });
        setMasterStocks(filtered);
      }
    })();
  }, [showSearchModal, marketRegion]);

  const handleAdd = async (stock: MasterStock) => {
    setAdding(stock.symbol);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_watchlist').insert({ user_id: user.id, symbol: stock.symbol });
    await loadUserWatchlist();
    setAdding(null);
  };

  const handleRemove = async (symbol: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_watchlist').delete().eq('user_id', user.id).eq('symbol', symbol);
    await loadUserWatchlist();
  };

  // Filter by market region
  const regionFiltered = watchlist.filter(item => {
    const isIndian = isIndianSymbol(item.yahooSymbol);
    return marketRegion === 'IN' ? isIndian : !isIndian;
  });

  const filtered = search
    ? regionFiltered.filter(i => i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()))
    : regionFiltered;

  const filteredMaster = modalSearch
    ? masterStocks.filter(s => s.symbol.toLowerCase().includes(modalSearch.toLowerCase()) || s.name.toLowerCase().includes(modalSearch.toLowerCase()))
    : masterStocks;

  // Convert US stock prices to INR for display
  const displayPrice = (item: { price: number; yahooSymbol?: string }) => {
    const isUS = !isIndianSymbol(item.yahooSymbol);
    const price = isUS ? item.price * usdToInr : item.price;
    return '₹' + price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Watchlist <span className="text-[9px] text-muted-foreground font-mono ml-1">{marketRegion === 'IN' ? '🇮🇳 NSE' : '🇺🇸 US'}</span>
        </h2>
        <div className="flex items-center gap-2">
          {marketRegion === 'US' && (
            <span className="text-[8px] text-muted-foreground font-mono">1 USD = ₹{usdToInr.toFixed(2)}</span>
          )}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Search & add stocks"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick filter within watchlist */}
      {regionFiltered.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-secondary rounded px-2 py-1">
            <Search className="w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter watchlist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {regionFiltered.length === 0 && (
          <div className="p-6 text-center">
            <Star className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-2">
              No {marketRegion === 'IN' ? 'Indian' : 'US'} stocks in your watchlist
            </p>
            <button
              onClick={() => setShowSearchModal(true)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Search & add {marketRegion === 'IN' ? 'NSE' : 'US'} stocks
            </button>
          </div>
        )}
        {filtered.map(item => (
          <div
            key={item.symbol}
            className={`group w-full flex items-center justify-between px-4 py-2 border-b border-border transition-colors hover:bg-accent cursor-pointer ${
              selectedSymbol === item.symbol ? 'bg-accent' : ''
            }`}
            onClick={() => setSelectedSymbol(item.symbol)}
          >
            <div className="text-left min-w-0">
              <div className="font-mono text-xs font-semibold text-foreground truncate">{item.symbol}</div>
              <span className="text-[10px] text-muted-foreground truncate block">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right flex-shrink-0">
                {item.price === 0 ? (
                  <div className="text-[10px] text-muted-foreground animate-pulse">...</div>
                ) : (
                  <>
                    <div className="font-mono text-[11px] font-medium text-foreground">
                      {displayPrice(item)}
                    </div>
                    <div className={`font-mono text-[10px] font-medium ${item.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(item.symbol); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                title="Remove from watchlist"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && regionFiltered.length > 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">No matching stocks</div>
        )}
      </div>

      {/* Search & Add Modal - filtered by market region */}
      <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              Search {marketRegion === 'IN' ? 'Indian (NSE)' : 'US'} Stocks
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 bg-secondary rounded-md px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or symbol..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{masterStocks.length} {marketRegion === 'IN' ? 'NSE' : 'US'} stocks available</p>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5 min-h-0">
            {filteredMaster.map(stock => {
              const isAdded = userSymbols.has(stock.symbol);
              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold text-foreground">{stock.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate">{stock.name}</div>
                  </div>
                  {isAdded ? (
                    <button
                      onClick={() => handleRemove(stock.symbol)}
                      className="text-xs text-destructive hover:text-destructive/80 font-medium px-3 py-1 rounded border border-destructive/30 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAdd(stock)}
                      disabled={adding === stock.symbol}
                      className="text-xs text-primary hover:text-primary/80 font-medium px-3 py-1 rounded border border-primary/30 hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      {adding === stock.symbol ? 'Adding...' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
            {filteredMaster.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No {marketRegion === 'IN' ? 'NSE' : 'US'} stocks found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
