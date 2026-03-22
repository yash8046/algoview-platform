import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { supabase } from '@/integrations/supabase/client';
import { BookmarkPlus, BookmarkCheck, FlaskConical } from 'lucide-react';

export default function TradePanel() {
  const { selectedSymbol, watchlist, executeTrade, balance, loadUserWatchlist, currentChartPrice } = useTradingStore();
  const [quantity, setQuantity] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const currentAsset = watchlist.find(w => w.symbol === selectedSymbol);
  const isInWatchlist = !!currentAsset;
  const price = currentAsset?.price || currentChartPrice || 0;
  const total = price * Number(quantity);
  const canBuy = total <= balance && Number(quantity) > 0 && price > 0;

  const handleTrade = (side: 'buy' | 'sell') => {
    if (Number(quantity) <= 0 || price <= 0) return;
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

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Simulate Trade</h2>
        </div>
        {isInWatchlist ? (
          <span className="flex items-center gap-1 text-[10px] text-gain font-medium">
            <BookmarkCheck className="w-3.5 h-3.5" />
            In Watchlist
          </span>
        ) : (
          <button
            onClick={handleAddToWatchlist}
            disabled={addingToWatchlist}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {addingToWatchlist ? 'Adding...' : 'Add to Watchlist'}
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {/* Simulation badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-warning/10 border border-warning/20">
          <FlaskConical className="w-3 h-3 text-warning" />
          <span className="text-[10px] text-warning font-medium">Simulation Mode · No real money involved</span>
        </div>

        <div className="flex gap-2">
          {(['market', 'limit'] as const).map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                orderType === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Symbol</label>
          <div className="bg-secondary rounded px-3 py-2 font-mono text-sm text-foreground">{selectedSymbol}</div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Price <span className="text-warning/70">(~15min delayed)</span></label>
          <div className="bg-secondary rounded px-3 py-2 font-mono text-sm text-foreground">
            {price > 0 ? `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Loading...'}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Quantity</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="w-full bg-secondary rounded px-3 py-2 font-mono text-sm text-foreground border border-border focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Total</span>
          <span className="font-mono text-foreground">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleTrade('buy')}
            disabled={!canBuy}
            className="flex-1 py-2.5 rounded font-semibold text-xs bg-gain text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed glow-gain"
          >
            SIM LONG ↑
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={price <= 0}
            className="flex-1 py-2.5 rounded font-semibold text-xs bg-loss text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed glow-loss"
          >
            SIM SHORT ↓
          </button>
        </div>
      </div>
    </div>
  );
}
