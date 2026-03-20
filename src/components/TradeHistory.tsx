import { useTradingStore } from '@/stores/tradingStore';
import { FlaskConical } from 'lucide-react';

export default function TradeHistory() {
  const { trades } = useTradingStore();

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-1.5">
        <FlaskConical className="w-3 h-3 text-warning" />
        <h2 className="text-sm font-semibold text-foreground">Simulation History</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin max-h-48">
        {trades.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No simulated trades yet</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="px-4 py-2 text-left font-medium">Side</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Sim P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 20).map(trade => (
                <tr key={trade.id} className="border-b border-border">
                  <td className="px-4 py-2 text-muted-foreground font-mono">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 font-mono font-semibold text-foreground">{trade.symbol}</td>
                  <td className="px-4 py-2">
                    <span className={`font-mono font-semibold uppercase ${trade.side === 'buy' ? 'text-gain' : 'text-loss'}`}>
                      {trade.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-foreground">₹{trade.price.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">{trade.quantity}</td>
                  <td className={`px-4 py-2 text-right font-mono font-medium ${
                    trade.pnl !== undefined ? (trade.pnl >= 0 ? 'text-gain' : 'text-loss') : 'text-muted-foreground'
                  }`}>
                    {trade.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : ''}₹${Math.abs(trade.pnl).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
