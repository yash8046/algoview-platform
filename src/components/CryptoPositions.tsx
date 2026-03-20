import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { X, ArrowUpRight, ArrowDownRight, FlaskConical } from 'lucide-react';
import { formatINR } from '@/lib/exchangeRate';

export default function CryptoPositions() {
  const { positions, trades, closePosition } = useCryptoStore();

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden h-full">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="w-3 h-3 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Simulated Positions</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">{positions.length} open</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {positions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No simulated positions</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Pair</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Current</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Sim P&L</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
                const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                const pair = CRYPTO_PAIRS.find((p) => p.symbol === pos.pair);
                return (
                  <tr key={pos.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{pair?.label || pos.pair}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatINR(pos.entryPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{formatINR(pos.currentPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{pos.quantity}</td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      <span className="flex items-center justify-end gap-0.5">
                        {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {formatINR(Math.abs(pnl))} ({pnlPct.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => closePosition(pos.id)} className="p-1 rounded hover:bg-loss/20 transition-colors">
                        <X className="w-3 h-3 text-loss" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {trades.length > 0 && (
        <>
          <div className="px-4 py-1.5 bg-panel-header border-t border-b border-border">
            <span className="text-[11px] text-muted-foreground font-medium">Recent Simulated Trades</span>
          </div>
          <div className="max-h-28 overflow-y-auto scrollbar-thin">
            {trades.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[11px]">
                <span className={`font-mono font-bold ${t.side === 'buy' ? 'text-gain' : 'text-loss'}`}>
                  {t.side === 'buy' ? 'LONG' : 'SHORT'}
                </span>
                <span className="font-mono text-foreground">{t.pair}</span>
                <span className="font-mono text-muted-foreground">{t.quantity} @ {formatINR(t.price)}</span>
                {t.pnl !== undefined && (
                  <span className={`font-mono ${t.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {t.pnl >= 0 ? '+' : ''}{formatINR(Math.abs(t.pnl))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
