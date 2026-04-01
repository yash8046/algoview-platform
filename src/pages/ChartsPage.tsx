import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TradingChart from '@/components/TradingChart';
import CryptoChart from '@/components/CryptoChart';
import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { ChevronDown, Search } from 'lucide-react';

type ChartMode = 'stocks' | 'crypto';

export default function ChartsPage() {
  const location = useLocation();
  const navState = location.state as { mode?: ChartMode; symbol?: string } | null;
  const [mode, setMode] = useState<ChartMode>(navState?.mode || 'stocks');
  const { watchlist, selectedSymbol, setSelectedSymbol } = useTradingStore();
  const { selectedPair, setSelectedPair } = useCryptoStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (navState?.symbol) {
      if (navState.mode === 'stocks') setSelectedSymbol(navState.symbol);
      else if (navState.mode === 'crypto') setSelectedPair(navState.symbol);
    }
  }, [navState]);

  const currentSymbol = mode === 'stocks'
    ? (selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`)
    : CRYPTO_PAIRS.find(p => p.symbol === selectedPair)?.label || selectedPair;

  const filteredWatchlist = watchlist.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCrypto = CRYPTO_PAIRS.filter(p =>
    p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background pb-[60px]" style={{ overscrollBehavior: 'contain' }}>
      {/* SYMBOL HEADER — Only symbol dropdown, no profile, no toggle */}
      <div
        className="h-11 flex-shrink-0 flex items-center bg-card border-b border-border/40 px-2 z-20"
      >
        <div className="relative flex items-center h-full">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-1.5 px-2 h-full hover:bg-accent/30 transition-colors rounded"
          >
            <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[200px]">
              {currentSymbol}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Dropdown: search + Stock/Crypto tabs inside */}
          {searchOpen && (
            <div className="absolute top-full left-0 z-50 w-72 bg-card border border-border/50 rounded-b-lg shadow-2xl">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search symbol..."
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1 font-mono"
                />
              </div>
              {/* Stock / Crypto tabs INSIDE dropdown */}
              <div className="flex border-b border-border/20">
                <button
                  onClick={() => setMode('stocks')}
                  className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
                    mode === 'stocks' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                  }`}
                >
                  Stocks
                </button>
                <button
                  onClick={() => setMode('crypto')}
                  className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
                    mode === 'crypto' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                  }`}
                >
                  Crypto
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto scrollbar-thin">
                {mode === 'stocks' ? (
                  filteredWatchlist.length > 0 ? filteredWatchlist.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2.5 text-xs font-mono hover:bg-accent/30 transition-colors flex items-center justify-between ${
                        selectedSymbol === item.symbol ? 'text-primary bg-primary/5' : 'text-foreground'
                      }`}
                    >
                      <span>{item.symbol}</span>
                      {item.price > 0 && (
                        <span className="text-[10px] text-muted-foreground">₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                      )}
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
                      className={`w-full text-left px-3 py-2.5 text-xs font-mono hover:bg-accent/30 transition-colors ${
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
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ overscrollBehavior: 'none' }}>
        <div className="h-full w-full min-w-0 min-h-0 relative" style={{ touchAction: 'none' }}>
          {mode === 'stocks' ? <TradingChart toolbarLeft /> : <CryptoChart toolbarLeft />}
        </div>
      </div>

      {/* Close search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
        />
      )}
    </div>
  );
}
