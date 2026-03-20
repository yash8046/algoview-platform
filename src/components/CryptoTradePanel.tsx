import { useState } from 'react';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { useCryptoData } from '@/hooks/useCryptoData';
import { formatINR } from '@/lib/exchangeRate';

export default function CryptoTradePanel() {
  const { selectedPair, balance, positions, executeTrade, usdToInr } = useCryptoStore();
  const { livePrice } = useCryptoData(selectedPair, '1m');
  const [quantity, setQuantity] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  const pairInfo = CRYPTO_PAIRS.find((p) => p.symbol === selectedPair);
  const hasPosition = positions.some((p) => p.pair === selectedPair);
  const livePriceINR = livePrice * usdToInr;
  const total = livePriceINR * (parseFloat(quantity) || 0);
  const canTrade = livePrice > 0 && parseFloat(quantity) > 0 && (side === 'sell' ? hasPosition : total <= balance);

  const handleTrade = () => {
    if (!canTrade) return;
    executeTrade(selectedPair, side, livePrice, parseFloat(quantity));
    setQuantity('');
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Paper Trade</h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-1 bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setSide('buy')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded transition-colors ${
              side === 'buy' ? 'bg-gain/20 text-gain' : 'text-muted-foreground hover:text-foreground'
            }`}
          >BUY</button>
          <button
            onClick={() => setSide('sell')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded transition-colors ${
              side === 'sell' ? 'bg-loss/20 text-loss' : 'text-muted-foreground hover:text-foreground'
            }`}
          >SELL</button>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground">Market Price</label>
          <div className="font-mono text-sm font-bold text-foreground mt-0.5">
            {formatINR(livePriceINR)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Rate: ₹{usdToInr.toFixed(2)}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground">Quantity ({pairInfo?.baseAsset})</label>
          <input
            type="number" step="any" min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono text-foreground">{formatINR(total)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-mono text-foreground">{formatINR(balance)}</span>
        </div>

        <button
          onClick={handleTrade}
          disabled={!canTrade}
          className={`w-full py-2 rounded text-xs font-bold transition-colors ${
            side === 'buy'
              ? 'bg-gain hover:bg-gain/80 text-primary-foreground disabled:bg-gain/30 disabled:text-muted-foreground'
              : 'bg-loss hover:bg-loss/80 text-destructive-foreground disabled:bg-loss/30 disabled:text-muted-foreground'
          }`}
        >
          {side === 'buy' ? 'BUY' : 'SELL'} {pairInfo?.baseAsset}
        </button>
      </div>
    </div>
  );
}
