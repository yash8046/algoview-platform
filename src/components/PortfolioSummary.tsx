import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown, Wallet, FlaskConical } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getExplanation(returnPercent: number, totalPnl: number): string {
  if (totalPnl === 0) return 'Start trading to see your performance here.';
  if (returnPercent > 5) return 'Great! Your portfolio is performing well. 🎉';
  if (returnPercent > 0) return 'Your portfolio has grown slightly. Keep it up!';
  if (returnPercent > -2) return 'Your portfolio has dipped a little. This is normal.';
  return 'Your portfolio has decreased. Consider reviewing your strategy.';
}

export default function PortfolioSummary() {
  const { balance, initialBalance, positions, trades } = useTradingStore();
  const isMobile = useIsMobile();

  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.currentPrice - p.entryPrice) * p.quantity, 0);
  const realizedPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;
  const totalValue = balance + positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const returnPercent = ((totalValue - initialBalance) / initialBalance) * 100;
  const todayTrades = trades.filter(t => {
    const d = new Date(t.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todayChange = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const stats = [
    {
      label: 'Total Value',
      value: formatINR(totalValue),
      icon: Wallet,
      positive: totalValue >= initialBalance,
    },
    {
      label: "Today's Change",
      value: `${todayChange >= 0 ? '+' : ''}${formatINR(Math.abs(todayChange))}`,
      icon: todayChange >= 0 ? TrendingUp : TrendingDown,
      positive: todayChange >= 0,
    },
    {
      label: 'Overall P&L',
      value: `${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%`,
      sub: `${totalPnl >= 0 ? '+' : ''}${formatINR(Math.abs(totalPnl))}`,
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      positive: totalPnl >= 0,
    },
  ];

  const explanation = getExplanation(returnPercent, totalPnl);

  if (isMobile) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-1">
          <FlaskConical className="w-3 h-3 text-warning" />
          <span className="text-[9px] text-warning font-medium">Simulation · Virtual Money</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {stats.map(stat => (
            <div key={stat.label} className="bg-card rounded-lg border border-border p-2 text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.positive ? 'text-gain' : 'text-loss'}`} />
              <div className={`font-mono text-xs font-bold ${stat.positive ? 'text-gain' : 'text-loss'}`}>
                {stat.value}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</div>
              {stat.sub && <div className={`text-[9px] font-mono ${stat.positive ? 'text-gain/70' : 'text-loss/70'}`}>{stat.sub}</div>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-1">{explanation}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <FlaskConical className="w-3 h-3 text-warning" />
        <span className="text-[9px] text-warning font-medium">Simulation Mode · Virtual Money</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
            <div className={`p-2 rounded-md ${stat.positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
              <stat.icon className={`w-5 h-5 ${stat.positive ? 'text-gain' : 'text-loss'}`} />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              <div className={`font-mono text-base font-bold ${stat.positive ? 'text-gain' : 'text-loss'}`}>
                {stat.value}
              </div>
              {stat.sub && <div className={`text-[10px] font-mono ${stat.positive ? 'text-gain/70' : 'text-loss/70'}`}>{stat.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground px-1">{explanation}</p>
    </div>
  );
}
