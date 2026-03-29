import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTradingStore } from '@/stores/tradingStore';

interface MarketStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

// Module-level cache that persists across remounts
const moversCache: Record<string, { gainers: MarketStock[]; losers: MarketStock[]; ts: number }> = {};
const CACHE_TTL = 3 * 60_000; // 3 minutes

export default function ExploreStocks() {
  const navigate = useNavigate();
  const { marketRegion } = useTradingStore();
  const [gainers, setGainers] = useState<MarketStock[]>([]);
  const [losers, setLosers] = useState<MarketStock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovers = useCallback(async (force = false) => {
    const cached = moversCache[marketRegion];
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      setGainers(cached.gainers);
      setLosers(cached.losers);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-movers', {
        body: { count: 10, market: marketRegion },
      });
      if (data) {
        const g = data.gainers?.length ? data.gainers : [];
        const l = data.losers?.length ? data.losers : [];
        setGainers(g);
        setLosers(l);
        moversCache[marketRegion] = { gainers: g, losers: l, ts: Date.now() };
      }
    } catch (e) {
      console.warn('Failed to fetch market movers:', e);
    } finally {
      setLoading(false);
    }
  }, [marketRegion]);

  useEffect(() => {
    fetchMovers();
    const interval = setInterval(() => fetchMovers(), 5 * 60_000);
    return () => clearInterval(interval);
  }, [fetchMovers]);

  // Expose refresh for pull-to-refresh
  (ExploreStocks as any).__refresh = () => fetchMovers(true);

  if (!loading && gainers.length === 0 && losers.length === 0) return null;

  const currencySymbol = marketRegion === 'IN' ? '₹' : '$';
  const exchangeLabel = marketRegion === 'IN' ? 'NSE' : 'US';

  const SkeletonCards = () => (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 min-w-[105px] animate-pulse">
          <div className="h-3 w-12 bg-muted rounded mb-1" />
          <div className="h-2.5 w-16 bg-muted rounded mb-1.5" />
          <div className="h-2.5 w-10 bg-muted rounded" />
        </div>
      ))}
    </>
  );

  const StockCard = ({ s }: { s: MarketStock }) => (
    <button
      onClick={() => navigate('/charts', { state: { mode: 'stocks', symbol: s.symbol } })}
      className="flex-shrink-0 bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 min-w-[105px] text-left active:scale-95 transition-all hover:bg-secondary/50"
    >
      <div className="font-mono text-[11px] font-semibold text-foreground truncate">{s.symbol}</div>
      <div className="text-[9px] text-muted-foreground truncate mb-0.5">{s.name}</div>
      <div className="font-mono text-[10px] text-foreground">
        {currencySymbol}{s.price.toLocaleString(marketRegion === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 1 })}
      </div>
      <div className={`font-mono text-[10px] font-medium ${s.change >= 0 ? 'text-gain' : 'text-loss'}`}>
        {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
      </div>
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Market Gainers */}
      <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-gain" />
            <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Market Movers ↑</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-mono">Live · {exchangeLabel}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
          {loading ? <SkeletonCards /> : gainers.map(s => <StockCard key={s.symbol} s={s} />)}
        </div>
      </div>

      {/* Market Losers */}
      {(loading || losers.length > 0) && (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5 text-loss" />
              <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Market Movers ↓</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-mono">Live · {exchangeLabel}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
            {loading ? <SkeletonCards /> : losers.map(s => <StockCard key={s.symbol} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
