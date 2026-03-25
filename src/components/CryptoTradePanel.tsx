import { useState } from 'react';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { useCryptoData } from '@/hooks/useCryptoData';
import { formatINR } from '@/lib/exchangeRate';
import { FlaskConical, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoTradePanel() {
  const { selectedPair, balance, positions, executeTrade, usdToInr } = useCryptoStore();
  const { livePrice } = useCryptoData(selectedPair, '1m');
  const [quantity, setQuantity] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  const pairInfo = CRYPTO_PAIRS.find((p) => p.symbol === selectedPair);
  const currentPosition = positions.find((p) => p.pair === selectedPair);
  const heldQty = currentPosition?.quantity || 0;
  const livePriceINR = livePrice * usdToInr;
  const total = livePriceINR * (parseFloat(quantity) || 0);
  const canTrade = livePrice > 0 && parseFloat(quantity) > 0 &&
    (side === 'sell' ? (heldQty > 0 && parseFloat(quantity) <= heldQty) : total <= balance);

  const handleTrade = () => {
    if (!canTrade) {
      if (side === 'sell') {
        toast.error(heldQty === 0 ? `No ${pairInfo?.baseAsset} to sell` : `Max: ${heldQty} ${pairInfo?.baseAsset}`);
      }
      return;
    }
    executeTrade(selectedPair, side, livePrice, parseFloat(quantity));
    setQuantity('');
  };

  const setMaxSell = () => {
    if (heldQty > 0) setQuantity(String(heldQty));
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden backdrop-blur-sm">
      <div className="px-4 py-2.5 bg-gradient-to-r from-card to-secondary/30 border-b border-border flex items-center gap-2">
        <div className="p-1 rounded-md bg-warning/10">
          <Zap className="w-3.5 h-3.5 text-warning" />
        </div>
        <h2 className="text-xs font-bold text-foreground tracking-wide uppercase">Trade</h2>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/5 border border-warning/10">
          <FlaskConical className="w-2.5 h-2.5 text-warning/70" />
          <span className="text-[9px] text-warning/70 font-medium">Simulation · Virtual Money</span>
        </div>

        <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button onClick={() => setSide('buy')}
            className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all tracking-wider flex items-center justify-center gap-1 ${
              side === 'buy' ? 'bg-gain/15 text-gain shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <TrendingUp className="w-3 h-3" /> LONG
          </button>
          <button onClick={() => setSide('sell')}
            className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all tracking-wider flex items-center justify-center gap-1 ${
              side === 'sell' ? 'bg-loss/15 text-loss shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <TrendingDown className="w-3 h-3" /> SHORT
          </button>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Market Price</label>
          <div className="font-mono text-sm font-bold text-foreground mt-0.5">
            {formatINR(livePriceINR)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/50">
            ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ₹{usdToInr.toFixed(2)}/USD
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">Qty ({pairInfo?.baseAsset})</label>
            {heldQty > 0 && (
              <button onClick={setMaxSell} className="text-[9px] text-primary hover:underline font-mono">
                Held: {heldQty} (Max)
              </button>
            )}
          </div>
          <input type="number" step="any" min="0" value={quantity}
            onChange={(e) => setQuantity(e.target.value)} placeholder="0.00"
            className="w-full mt-0.5 px-3 py-2 bg-secondary/40 border border-border/50 rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>

        <div className="space-y-1 py-1 border-t border-b border-border/30">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground/70">Total</span>
            <span className="font-mono font-bold text-foreground">{formatINR(total)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground/70">Balance</span>
            <span className="font-mono text-muted-foreground">{formatINR(balance)}</span>
          </div>
        </div>

        <button onClick={handleTrade} disabled={!canTrade}
          className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            side === 'buy'
              ? 'bg-gain hover:brightness-110 text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed glow-gain'
              : 'bg-loss hover:brightness-110 text-destructive-foreground disabled:opacity-30 disabled:cursor-not-allowed glow-loss'
          }`}>
          {side === 'buy' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {side === 'buy' ? 'LONG' : 'SHORT'} {pairInfo?.baseAsset}
        </button>

      </div>
    </div>
  );
}