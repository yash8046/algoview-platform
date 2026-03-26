import { useState, useEffect } from 'react';
import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradingStore } from '@/stores/tradingStore';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';

interface ExploreStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  loading: boolean;
}

// Curated list of popular NSE stocks across sectors — live data decides ranking
const EXPLORE_SYMBOLS = [
  { symbol: 'IRFC', name: 'IRFC' },
  { symbol: 'ZOMATO', name: 'Zomato' },
  { symbol: 'TATAPOWER', name: 'Tata Power' },
  { symbol: 'ADANIGREEN', name: 'Adani Green' },
  { symbol: 'JIOFIN', name: 'Jio Financial' },
  { symbol: 'NHPC', name: 'NHPC' },
  { symbol: 'POLYCAB', name: 'Polycab' },
  { symbol: 'DIXON', name: 'Dixon Tech' },
  { symbol: 'PERSISTENT', name: 'Persistent Sys' },
  { symbol: 'PAYTM', name: 'Paytm' },
  { symbol: 'SUZLON', name: 'Suzlon Energy' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'ITC', name: 'ITC' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
];

export default function ExploreStocks() {
  const navigate = useNavigate();
  const { watchlist } = useTradingStore();
  const [stocks, setStocks] = useState<ExploreStock[]>([]);

  const watchlistSymbols = new Set(watchlist.map(w => w.symbol));
  const exploreOnly = EXPLORE_SYMBOLS.filter(s => !watchlistSymbols.has(s.symbol));

  useEffect(() => {
    const toFetch = exploreOnly.slice(0, 10);
    setStocks(toFetch.map(s => ({ ...s, price: 0, change: 0, loading: true })));

    toFetch.forEach(async (s, idx) => {
      try {
        const data = await fetchYahooFinanceData(s.symbol, '1D');
        const price = data.regularMarketPrice || (data.candles.length > 0 ? data.candles[data.candles.length - 1].close : 0);
        const prevClose = data.previousClose || (data.candles.length > 0 ? data.candles[0].open : price);
        const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        setStocks(prev => {
          const updated = prev.map((st, i) => i === idx ? { ...st, price, change, loading: false } : st);
          // Sort by change descending — top gainers first
          const loaded = updated.filter(s => !s.loading);
          const still = updated.filter(s => s.loading);
          loaded.sort((a, b) => b.change - a.change);
          return [...loaded, ...still];
        });
      } catch {
        setStocks(prev => prev.map((st, i) => i === idx ? { ...st, loading: false } : st));
      }
    });
  }, [watchlist.length]);

  if (exploreOnly.length === 0) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-primary/70" />
          <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Explore</span>
        </div>
        <span className="text-[9px] text-muted-foreground font-mono">Top Gainers Today</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
        {stocks.map(s => (
          <button
            key={s.symbol}
            onClick={() => navigate('/charts', { state: { mode: 'stocks', symbol: s.symbol } })}
            className="flex-shrink-0 bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 min-w-[105px] text-left active:scale-95 transition-all hover:bg-secondary/50"
          >
            <div className="font-mono text-[11px] font-semibold text-foreground truncate">{s.symbol}</div>
            <div className="text-[9px] text-muted-foreground truncate mb-0.5">{s.name}</div>
            {s.loading ? (
              <div className="text-[9px] text-muted-foreground animate-pulse">Loading...</div>
            ) : (
              <>
                <div className="font-mono text-[10px] text-foreground">
                  ₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </div>
                <div className={`font-mono text-[10px] font-medium ${s.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                </div>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
