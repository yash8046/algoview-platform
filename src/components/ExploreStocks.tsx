import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ExploreStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

export default function ExploreStocks() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<ExploreStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMovers() {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('market-movers', {
          body: { count: 12 },
        });
        if (!cancelled && data?.gainers?.length) {
          setStocks(data.gainers);
        }
      } catch (e) {
        console.warn('Failed to fetch market movers:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMovers();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMovers, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!loading && stocks.length === 0) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-gain" />
          <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">Trending</span>
        </div>
        <span className="text-[9px] text-muted-foreground font-mono">Live Top Gainers</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin p-2.5 pb-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 min-w-[105px] animate-pulse">
              <div className="h-3 w-12 bg-muted rounded mb-1" />
              <div className="h-2.5 w-16 bg-muted rounded mb-1.5" />
              <div className="h-2.5 w-10 bg-muted rounded" />
            </div>
          ))
        ) : (
          stocks.map(s => (
            <button
              key={s.symbol}
              onClick={() => navigate('/charts', { state: { mode: 'stocks', symbol: s.symbol } })}
              className="flex-shrink-0 bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 min-w-[105px] text-left active:scale-95 transition-all hover:bg-secondary/50"
            >
              <div className="font-mono text-[11px] font-semibold text-foreground truncate">{s.symbol}</div>
              <div className="text-[9px] text-muted-foreground truncate mb-0.5">{s.name}</div>
              <div className="font-mono text-[10px] text-foreground">
                ₹{s.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
              </div>
              <div className={`font-mono text-[10px] font-medium ${s.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
