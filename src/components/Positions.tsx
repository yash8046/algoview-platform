import { useTradingStore } from '@/stores/tradingStore';
import { X } from 'lucide-react';

export default function Positions() {
  const { positions, closePosition } = useTradingStore();

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Open Positions</h2>
        <span className="text-[11px] text-muted-foreground">{positions.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {positions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No open positions</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="px-4 py-2 text-right font-medium">Entry</th>
                <th className="px-4 py-2 text-right font-medium">Current</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">P&L</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => {
                const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
                const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                return (
                  <tr key={pos.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2 font-mono font-semibold text-foreground">{pos.symbol}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">₹{pos.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">₹{pos.currentPrice.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{pos.quantity}</td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toFixed(2)} ({pnlPercent.toFixed(1)}%)
                    </td>
                    <td className="px-4 py-2 text-right">
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
    </div>
  );
}
