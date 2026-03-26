import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import CryptoChart from '@/components/CryptoChart';
import CryptoTradePanel from '@/components/CryptoTradePanel';
import CryptoPositions from '@/components/CryptoPositions';
import CryptoTradeHistory from '@/components/CryptoTradeHistory';
import CryptoAISignals from '@/components/CryptoAISignals';
import CryptoTopMovers from '@/components/CryptoTopMovers';
import { useCryptoStore } from '@/stores/cryptoStore';
import { formatINR } from '@/lib/exchangeRate';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

function useIsLandscape() {
  const [landscape, setLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 200));
    return () => {
      window.removeEventListener('resize', check);
    };
  }, []);
  return landscape;
}

function CollapsibleSection({ title, count, defaultOpen = false, children }: {
  title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-panel-header border-b border-border active:bg-accent/50 transition-colors"
        style={{ minHeight: 40 }}
      >
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <div className="flex items-center gap-1.5">
          {count !== undefined && (
            <span className="text-[10px] text-muted-foreground">{count}</span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="max-h-40 overflow-y-auto scrollbar-thin">{children}</div>}
    </div>
  );
}

function CryptoSummary() {
  const { balance, initialBalance, positions, trades } = useCryptoStore();

  const investedValue = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const currentValue = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const unrealizedPnl = currentValue - investedValue;
  const realizedPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;
  const portfolioValue = balance + currentValue;
  const returnPct = ((portfolioValue - initialBalance) / initialBalance) * 100;

  const stats = [
    { label: 'Sim Portfolio', value: formatINR(portfolioValue), icon: DollarSign, positive: portfolioValue >= initialBalance },
    { label: 'Virtual Cash', value: formatINR(balance), icon: BarChart3, positive: true },
    { label: 'Sim P&L', value: `${unrealizedPnl >= 0 ? '+' : '-'}${formatINR(Math.abs(unrealizedPnl))}`, icon: unrealizedPnl >= 0 ? TrendingUp : TrendingDown, positive: unrealizedPnl >= 0 },
    { label: 'Return', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: returnPct >= 0 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-card rounded-lg border border-border p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
          <div className={`p-1.5 sm:p-2 rounded-md ${s.positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
            <s.icon className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${s.positive ? 'text-gain' : 'text-loss'}`} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{s.label}</div>
            <div className={`font-mono text-xs sm:text-sm font-semibold truncate ${s.positive ? 'text-gain' : 'text-loss'}`}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CryptoPage() {
  const { loadExchangeRate, loadFromDB, positions, trades } = useCryptoStore();
  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();
  const [showSidePanel, setShowSidePanel] = useState(true);

  useEffect(() => {
    loadExchangeRate();
    loadFromDB();
  }, []);

  // Mobile landscape: no chart here, use Charts page
  if (isMobile && isLandscape) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden safe-area-top">
        <div className="flex-1 flex gap-1 p-1 min-h-0 overflow-y-auto scrollbar-thin">
          <div className="flex-1 flex flex-col gap-1">
            <CryptoSummary />
            <CryptoTradePanel />
            <CryptoAISignals />
            <CollapsibleSection title="▼ Simulated Positions" count={positions.length} defaultOpen={false}>
              <CryptoPositions />
            </CollapsibleSection>
            <CollapsibleSection title="▶ Simulation History" count={trades.length} defaultOpen={false}>
              <CryptoTradeHistory />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    );
  }

  // Mobile portrait: TopBar sticky, content scrolls
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <div className="flex-shrink-0 sticky top-0 z-30">
          <TopBar />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20">
          <div className="p-2 space-y-2">
            <CryptoSummary />
            <CryptoTopMovers />
            <div className="h-[180px]">
              <CryptoChart minimal />
            </div>
            <CryptoTradePanel />
            <CryptoAISignals />
            <CollapsibleSection title="▼ Simulated Positions" count={positions.length} defaultOpen={true}>
              <CryptoPositions />
            </CollapsibleSection>
            <CollapsibleSection title="▶ Simulation History" count={trades.length} defaultOpen={false}>
              <CryptoTradeHistory />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        <CryptoSummary />
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex-1 min-h-0">
              <CryptoChart minimal />
            </div>
            <div className="grid grid-cols-2 gap-2 flex-shrink-0" style={{ maxHeight: '180px' }}>
              <CryptoPositions />
              <CryptoTradeHistory />
            </div>
          </div>
          <div className="w-72 flex-shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="flex-shrink-0">
              <CryptoTradePanel />
            </div>
            <div className="flex-shrink-0">
              <CryptoAISignals />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
