import TopBar from '@/components/TopBar';
import CryptoChart from '@/components/CryptoChart';
import CryptoTradePanel from '@/components/CryptoTradePanel';
import CryptoPositions from '@/components/CryptoPositions';
import CryptoAISignals from '@/components/CryptoAISignals';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { useCryptoData } from '@/hooks/useCryptoData';
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

function CryptoSummary() {
  const { balance, initialBalance, positions, trades, selectedPair, selectedInterval } = useCryptoStore();
  const { livePrice } = useCryptoData(selectedPair, selectedInterval);

  const investedValue = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const currentValue = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const unrealizedPnl = currentValue - investedValue;
  const realizedPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;
  const portfolioValue = balance + currentValue;
  const returnPct = ((portfolioValue - initialBalance) / initialBalance) * 100;

  const fmt = (v: number) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = [
    { label: 'Portfolio', value: fmt(portfolioValue), icon: DollarSign, positive: portfolioValue >= initialBalance },
    { label: 'Cash', value: fmt(balance), icon: BarChart3, positive: true },
    { label: 'Unrealized P&L', value: `${unrealizedPnl >= 0 ? '+' : '-'}${fmt(unrealizedPnl)}`, icon: unrealizedPnl >= 0 ? TrendingUp : TrendingDown, positive: unrealizedPnl >= 0 },
    { label: 'Return', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: returnPct >= 0 },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
          <div className={`p-2 rounded-md ${s.positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
            <s.icon className={`w-4 h-4 ${s.positive ? 'text-gain' : 'text-loss'}`} />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
            <div className={`font-mono text-sm font-semibold ${s.positive ? 'text-gain' : 'text-loss'}`}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CryptoPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        <CryptoSummary />
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Chart + Positions */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex-1 min-h-0">
              <CryptoChart />
            </div>
            <div style={{ height: '200px' }}>
              <CryptoPositions />
            </div>
          </div>
          {/* Right panel */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-2">
            <CryptoTradePanel />
            <div className="flex-1 min-h-0">
              <CryptoAISignals />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
