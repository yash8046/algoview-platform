import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortfolioSummary() {
  const { balance, initialBalance, positions, trades } = useTradingStore();

  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.currentPrice - p.entryPrice) * p.quantity, 0);
  const realizedPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;
  const totalValue = balance + positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const returnPercent = ((totalValue - initialBalance) / initialBalance) * 100;

  const stats = [
    { label: 'Portfolio Value', value: formatINR(totalValue), icon: DollarSign, positive: totalValue >= initialBalance },
    { label: 'Cash Available', value: formatINR(balance), icon: BarChart3, positive: true },
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}${formatINR(Math.abs(totalPnl))}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: totalPnl >= 0 },
    { label: 'Return', value: `${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: returnPercent >= 0 },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(stat => (
        <div key={stat.label} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
          <div className={`p-2 rounded-md ${stat.positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
            <stat.icon className={`w-4 h-4 ${stat.positive ? 'text-gain' : 'text-loss'}`} />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{stat.label}</div>
            <div className={`font-mono text-sm font-semibold ${stat.positive ? 'text-gain' : 'text-loss'}`}>
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
