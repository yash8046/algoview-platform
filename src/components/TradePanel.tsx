import { useState, useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { supabase } from '@/integrations/supabase/client';
import { getUsdToInrRate, subscribeToRate } from '@/lib/exchangeRate';
import { BookmarkPlus, BookmarkCheck, FlaskConical, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

const INDIAN_INDICES = ['^NSEI', '^BSESN', '^NSEBANK'];
const isIndianSymbol = (yahooSymbol?: string) => {
  if (!yahooSymbol) return true;
  return yahooSymbol.endsWith('.NS') || yahooSymbol.endsWith('.BO') || INDIAN_INDICES.includes(yahooSymbol);
};

export default function TradePanel() {
  const { selectedSymbol, watchlist, executeTrade, balance, positions, loadUserWatchlist, currentChartPrice, marketRegion } = useTradingStore();
  const [quantity, setQuantity] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [usdToInr, setUsdToInr] = useState(85.5);

  useEffect(() => {
    getUsdToInrRate().then(setUsdToInr);
    const unsub = subscribeToRate(setUsdToInr);
    return unsub;
  }, []);

  const currentAsset = watchlist.find(w => w.symbol === selectedSymbol);
  const isInWatchlist = !!currentAsset;
  const rawPrice = currentAsset?.price || currentChartPrice || 0;
  const isUS = marketRegion === 'US' || (currentAsset && !isIndianSymbol(currentAsset.yahooSymbol));
  const price = isUS ? rawPrice * usdToInr : rawPrice;
  const total = price * Number(quantity);
  const canBuy = total <= balance && Number(quantity) > 0 && price > 0;

  const currentPosition = positions.find(p => p.symbol === selectedSymbol);
  const heldQty = currentPosition?.quantity || 0;
  const canSell = heldQty > 0 && Number(quantity) > 0 && Number(quantity) <= heldQty && price > 0;

  const handleTrade = (side: 'buy' | 'sell') => {
    if (Number(quantity) <= 0 || price <= 0) return;
    if (side === 'sell' && !canSell) {
      toast.error(heldQty === 0 ? `No ${selectedSymbol} shares to close` : `Max close quantity: ${heldQty}`);
      return;
    }
    executeTrade(selectedSymbol, side, price, Number(quantity));
    setQuantity('1');
  };

  const handleAddToWatchlist = async () => {
    setAddingToWatchlist(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingToWatchlist(false); return; }
    await supabase.from('user_watchlist').insert({ user_id: user.id, symbol: selectedSymbol });
    await loadUserWatchlist();
    setAddingToWatchlist(false);
  };

  const setMaxSell = () => {
    if (heldQty > 0) setQuantity(String(heldQty));
  };

  return (
    <div className="flex flex-col bg-card rounded-xl border border-border overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-card to-secondary/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-warning/10">
            <Zap className="w-3.5 h-3.5 text-warning" />
          </div>
          <h2 className="text-xs font-bold text-foreground tracking-wide uppercase">Simulate</h2>
        </div>
        {isInWatchlist ? (
          <span className="flex items-center gap-1 text-[10px] text-gain font-medium">
            <BookmarkCheck className="w-3.5 h-3.5" />
            Watchlist
          </span>
        ) : (
          <button onClick={handleAddToWatchlist} disabled={addingToWatchlist}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50">
            <BookmarkPlus className="w-3.5 h-3.5" />
            {addingToWatchlist ? '...' : 'Watch'}
          </button>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Sim badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/5 border border-warning/10">
          <FlaskConical className="w-2.5 h-2.5 text-warning/70" />
          <span className="text-[9px] text-warning/70 font-medium">Simulation · Virtual Money</span>
        </div>

        {/* Order type toggle */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
          {(['market', 'limit'] as const).map(type => (
            <button key={type} onClick={() => setOrderType(type)}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all capitalize tracking-wider ${
                orderType === type
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {type}
            </button>
          ))}
        </div>

        {/* Symbol */}
        <div>
          <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Symbol</label>
          <div className="bg-secondary/40 rounded-lg px-3 py-2 font-mono text-sm font-bold text-foreground mt-0.5 border border-border/50">
            {selectedSymbol}
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Price</label>
          <div className="bg-secondary/40 rounded-lg px-3 py-2 font-mono text-sm font-bold text-foreground mt-0.5 border border-border/50">
            {price > 0 ? `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '...'}
          </div>
          {isUS && rawPrice > 0 && (
            <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5">
              ${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ₹{usdToInr.toFixed(2)}/USD
            </div>
          )}
        </div>

        {/* Quantity + held info */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Quantity</label>
            {heldQty > 0 && (
              <button onClick={setMaxSell} className="text-[9px] text-primary hover:underline font-mono">
                Held: {heldQty} (Max)
              </button>
            )}
          </div>
          <input type="number" min="1" step="1" value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="w-full bg-secondary/40 rounded-lg px-3 py-2 font-mono text-sm text-foreground border border-border/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 mt-0.5 transition-all" />
        </div>

        {/* Totals */}
        <div className="space-y-1 py-1 border-t border-b border-border/30">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground/70">Order Value</span>
            <span className="font-mono font-bold text-foreground">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground/70">Cash Available</span>
            <span className="font-mono text-muted-foreground">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Buy / Sell buttons */}
        <div className="flex gap-2">
          <button onClick={() => handleTrade('buy')} disabled={!canBuy}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-gain text-primary-foreground hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed glow-gain">
            <TrendingUp className="w-3.5 h-3.5" />
            LONG
          </button>
          <button onClick={() => handleTrade('sell')} disabled={!canSell}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-loss text-destructive-foreground hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed glow-loss">
            <TrendingDown className="w-3.5 h-3.5" />
            SHORT
          </button>
        </div>

      </div>
    </div>
  );
}