import { useState } from 'react';
import TradingChart from '@/components/TradingChart';
import CryptoChart from '@/components/CryptoChart';
import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import {
  ChevronDown, Search, BarChart3, Bitcoin,
} from 'lucide-react';

type ChartMode = 'stocks' | 'crypto';

export default function ChartsPage() {
  const [mode, setMode] = useState<ChartMode>('stocks');
  const { watchlist, selectedSymbol, setSelectedSymbol } = useTradingStore();
  const { selectedPair, setSelectedPair } = useCryptoStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentSymbol = mode === 'stocks'
    ? (selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`)
    : CRYPTO_PAIRS.find(p => p.symbol === selectedPair)?.label || selectedPair;

  // Filter watchlist for search
  const filteredWatchlist = watchlist.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCrypto = CRYPTO_PAIRS.filter(p =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[hsl(var(--chart-bg))]">
      {/* ═══ TOP HEADER — 48px, TradingView-style thin bar ═══ */}
      <div className="h-12 flex-shrink-0 flex items-center bg-card border-b border-border/40 px-0 safe-area-top z-20">
        {/* Symbol selector */}
        <div className="relative flex items-center h-full border-r border-border/30">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-2 px-3 h-full hover:bg-accent/30 transition-colors min-w-[140px]"
          >
            <span className="font-mono text-xs font-semibold text-foreground truncate">
              {currentSymbol}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Search dropdown */}
          {searchOpen && (
            <div className="absolute top-full left-0 z-50 w-64 bg-card border border-border/50 rounded-b-lg shadow-2xl">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search symbol..."
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1 font-mono"
                />
              </div>
              {/* Mode tabs */}
              <div className="flex border-b border-border/20">
                <button
                  onClick={() => setMode('stocks')}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    mode === 'stocks' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                  }`}
                >
                  Stocks
                </button>
                <button
                  onClick={() => setMode('crypto')}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    mode === 'crypto' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                  }`}
                >
                  Crypto
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto scrollbar-thin">
                {mode === 'stocks' ? (
                  filteredWatchlist.length > 0 ? filteredWatchlist.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent/30 transition-colors ${
                        selectedSymbol === item.symbol ? 'text-primary bg-primary/5' : 'text-foreground'
                      }`}
                    >
                      {item.symbol}
                    </button>
                  )) : (
                    <div className="px-3 py-4 text-[10px] text-muted-foreground text-center">
                      Add stocks to watchlist first
                    </div>
                  )
                ) : (
                  filteredCrypto.map(p => (
                    <button
                      key={p.symbol}
                      onClick={() => {
                        setSelectedPair(p.symbol);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent/30 transition-colors ${
                        selectedPair === p.symbol ? 'text-primary bg-primary/5' : 'text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer — the chart components have their own timeframe/indicator controls */}
        <div className="flex-1" />

        {/* Mode indicator */}
        <div className="flex items-center gap-1 px-3 h-full border-l border-border/30">
          <div className="flex items-center bg-secondary/30 rounded p-0.5">
            <button
              onClick={() => setMode('stocks')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                mode === 'stocks'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span className="hidden sm:inline">Stocks</span>
            </button>
            <button
              onClick={() => setMode('crypto')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                mode === 'crypto'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bitcoin className="w-3 h-3" />
              <span className="hidden sm:inline">Crypto</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full w-full min-w-0 min-h-0 relative">
          {mode === 'stocks' ? <TradingChart /> : <CryptoChart />}
        </div>
      </div>

      {/* Close search overlay on outside click */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
        />
      )}
    </div>
  );
}
