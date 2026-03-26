import { useEffect, useState, useRef } from 'react';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { fetchAllTickers } from '@/lib/binanceApi';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerInfo {
  symbol: string;
  label: string;
  price: number;
  changePercent: number;
}

export default function CryptoTopMovers() {
  const { setSelectedPair, usdToInr } = useCryptoStore();
  const [tickers, setTickers] = useState<TickerInfo[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const symbols = CRYPTO_PAIRS.map(p => p.symbol);

    const load = async () => {
      try {
        // Single batch API call instead of 22+ individual calls
        const tickerMap = await fetchAllTickers(symbols);
        if (!mountedRef.current) return;

        const valid: TickerInfo[] = [];
        for (const p of CRYPTO_PAIRS) {
          const data = tickerMap.get(p.symbol.toUpperCase());
          if (data) {
            valid.push({
              symbol: p.symbol,
              label: p.baseAsset,
              price: parseFloat(data.lastPrice) * usdToInr,
              changePercent: parseFloat(data.priceChangePercent),
            });
          }
        }
        setTickers(valid);
      } catch (e) {
        console.warn('CryptoTopMovers fetch error:', e);
      }
    };

    load();
    const interval = setInterval(load, 60_000); // 60s instead of 30s
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [usdToInr]);

  if (tickers.length === 0) return null;

  const sorted = [...tickers].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter(t => t.changePercent > 0).slice(0, 8);
  const losers = [...sorted].reverse().filter(t => t.changePercent < 0).slice(0, 8);

  return (
    <div className="space-y-2">
      {gainers.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-2">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <TrendingUp className="w-3.5 h-3.5 text-gain" />
            <span className="text-[11px] font-semibold text-foreground">Top Gainers</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {gainers.map(t => (
              <button
                key={t.symbol}
                onClick={() => setSelectedPair(t.symbol)}
                className="flex-shrink-0 bg-gain/5 border border-gain/20 rounded-lg px-3 py-2 min-w-[90px] text-left active:scale-95 transition-transform"
              >
                <div className="font-mono text-[11px] font-semibold text-foreground">{t.label}</div>
                <div className="font-mono text-[10px] text-foreground">₹{t.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div className="font-mono text-[10px] font-medium text-gain">+{t.changePercent.toFixed(2)}%</div>
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
            {losers.map(t => (
              <button
                key={t.symbol}
                onClick={() => setSelectedPair(t.symbol)}
                className="flex-shrink-0 bg-loss/5 border border-loss/20 rounded-lg px-3 py-2 min-w-[90px] text-left active:scale-95 transition-transform"
              >
                <div className="font-mono text-[11px] font-semibold text-foreground">{t.label}</div>
                <div className="font-mono text-[10px] text-foreground">₹{t.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                <div className="font-mono text-[10px] font-medium text-loss">{t.changePercent.toFixed(2)}%</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
