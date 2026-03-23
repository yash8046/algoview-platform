import { useState } from 'react';
import TopBar from '@/components/TopBar';
import TradingChart from '@/components/TradingChart';
import CryptoChart from '@/components/CryptoChart';
import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { BarChart3, Bitcoin } from 'lucide-react';

type ChartMode = 'stocks' | 'crypto';

export default function ChartsPage() {
  const [mode, setMode] = useState<ChartMode>('stocks');
  const { watchlist, selectedSymbol, setSelectedSymbol } = useTradingStore();
  const { selectedPair, setSelectedPair } = useCryptoStore();
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col min-h-0 pb-20">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 px-2 pt-2">
          <button
            onClick={() => setMode('stocks')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
              mode === 'stocks'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Stocks
          </button>
          <button
            onClick={() => setMode('crypto')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
              mode === 'crypto'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            <Bitcoin className="w-3.5 h-3.5" />
            Crypto
          </button>
        </div>

        {/* Symbol picker */}
        <div className="px-2 pt-2">
          {mode === 'stocks' ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              {watchlist.length === 0 && (
                <span className="text-xs text-muted-foreground py-1">Add stocks to watchlist first</span>
              )}
              {watchlist.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium transition-colors min-h-[32px] ${
                    selectedSymbol === item.symbol
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'bg-secondary text-muted-foreground border border-border'
                  }`}
                >
                  {item.symbol}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              {CRYPTO_PAIRS.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => setSelectedPair(pair.symbol)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-medium transition-colors min-h-[32px] ${
                    selectedPair === pair.symbol
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'bg-secondary text-muted-foreground border border-border'
                  }`}
                >
                  {pair.baseAsset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0 p-2">
          {mode === 'stocks' ? <TradingChart /> : <CryptoChart />}
        </div>
      </div>
    </div>
  );
}
