import { useEffect, useState } from 'react';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { fetchTicker } from '@/lib/binanceApi';
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

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled(
        CRYPTO_PAIRS.map(async (p) => {
          const data = await fetchTicker(p.symbol);
          return {
            symbol: p.symbol,
            label: p.baseAsset,
            price: parseFloat(data.lastPrice) * usdToInr,
            changePercent: parseFloat(data.priceChangePercent),
          };
        })
      );
      const valid = results
        .filter((r): r is PromiseFulfilledResult<TickerInfo> => r.status === 'fulfilled')
        .map(r => r.value);
      setTickers(valid);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [usdToInr]);

  if (tickers.length === 0) return null;

  const sorted = [...tickers].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter(t => t.changePercent > 0);
  const losers = [...sorted].reverse().filter(t => t.changePercent < 0);

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
