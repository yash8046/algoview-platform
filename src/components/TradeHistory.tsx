import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { FlaskConical, Download, Check } from 'lucide-react';
import { exportTradesToCSV } from '@/lib/csvExport';

export default function TradeHistory() {
  const { trades } = useTradingStore();
  const [saved, setSaved] = useState(false);

  const handleExport = async () => {
    try {
      const uri = await exportTradesToCSV(trades);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (uri) {
        // Native: show toast with file location
        const { toast } = await import('sonner');
        toast.success('CSV saved to Documents folder', { duration: 3000 });
      }
    } catch (err) {
      const { toast } = await import('sonner');
      toast.error('Export failed: ' + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-1.5">
        <FlaskConical className="w-3 h-3 text-warning" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Simulation History</h2>
        {trades.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95"
            title="Export to CSV"
          >
            {saved ? <Check className="w-3 h-3 text-gain" /> : <Download className="w-3 h-3" />}
            <span className="hidden sm:inline">{saved ? 'Saved!' : 'CSV'}</span>
          </button>
        )}
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
