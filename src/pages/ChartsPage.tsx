import { useState } from 'react';
import TradingChart from '@/components/TradingChart';
import CryptoChart from '@/components/CryptoChart';
import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronDown, BarChart3, Bitcoin } from 'lucide-react';

type ChartMode = 'stocks' | 'crypto';

export default function ChartsPage() {
  const [mode, setMode] = useState<ChartMode>('stocks');
  const { watchlist, selectedSymbol, setSelectedSymbol } = useTradingStore();
  const { selectedPair, setSelectedPair } = useCryptoStore();
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Premium top bar — glassmorphic, thin */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/80 backdrop-blur-md border-b border-border/30 safe-area-top z-10">
        <div className="flex items-center gap-2">
          {/* Mode toggle — minimal pills */}
          <div className="flex items-center bg-secondary/40 rounded-lg p-0.5">
            <button
              onClick={() => setMode('stocks')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                mode === 'stocks'
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              Stocks
            </button>
            <button
              onClick={() => setMode('crypto')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                mode === 'crypto'
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bitcoin className="w-3 h-3" />
              Crypto
            </button>
          </div>

          {/* Symbol selector — dropdown style */}
          {mode === 'stocks' ? (
            <div className="relative">
              <select
                value={selectedSymbol}
                onChange={e => setSelectedSymbol(e.target.value)}
                className="appearance-none bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 pr-7 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer min-h-[32px]"
              >
                {watchlist.length === 0 && <option value="">Add to watchlist</option>}
                {watchlist.map(item => (
                  <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedPair}
                onChange={e => setSelectedPair(e.target.value)}
                className="appearance-none bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 pr-7 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer min-h-[32px]"
              >
                {CRYPTO_PAIRS.map(p => (
                  <option key={p.symbol} value={p.symbol}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Chart — fills everything, no padding, immersive */}
      <div className="flex-1 min-h-0 pb-16">
        {mode === 'stocks' ? <TradingChart /> : <CryptoChart />}
      </div>
    </div>
  );
}
