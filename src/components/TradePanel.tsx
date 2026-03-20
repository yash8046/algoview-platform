import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';

export default function TradePanel() {
  const { selectedSymbol, watchlist, executeTrade, balance } = useTradingStore();
  const [quantity, setQuantity] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');

  const currentAsset = watchlist.find(w => w.symbol === selectedSymbol);
  const price = currentAsset?.price || 0;
  const total = price * Number(quantity);
  const canBuy = total <= balance && Number(quantity) > 0 && price > 0;

  const handleTrade = (side: 'buy' | 'sell') => {
    if (Number(quantity) <= 0 || price <= 0) return;
    executeTrade(selectedSymbol, side, price, Number(quantity));
    setQuantity('1');
  };

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Trade</h2>
      </div>
      <div className="p-4 space-y-3">
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
          <label className="text-[11px] text-muted-foreground mb-1 block">Price</label>
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
            BUY
          </button>
          <button
            onClick={() => handleTrade('sell')}
            disabled={price <= 0}
            className="flex-1 py-2.5 rounded font-semibold text-xs bg-loss text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed glow-loss"
          >
            SELL
          </button>
        </div>
      </div>
    </div>
  );
}
