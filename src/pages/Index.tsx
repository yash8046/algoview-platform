import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import TradingChart from '@/components/TradingChart';
import Watchlist from '@/components/Watchlist';
import PortfolioSummary from '@/components/PortfolioSummary';
import TradePanel from '@/components/TradePanel';
import Positions from '@/components/Positions';
import TradeHistory from '@/components/TradeHistory';
import AISignals from '@/components/AISignals';
import TopPerformers from '@/components/TopPerformers';
import { useTradingStore } from '@/stores/tradingStore';
import { useIsMobile } from '@/hooks/use-mobile';
import GuidedTour from '@/components/GuidedTour';
import { PanelRightOpen, PanelRightClose, ChevronDown, ChevronUp } from 'lucide-react';

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

const Index = () => {
  const { loadFromDB, positions, trades } = useTradingStore();
  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();
  const [showSidePanel, setShowSidePanel] = useState(true);

  useEffect(() => {
    loadFromDB();
  }, []);

  // Mobile landscape: chart-focused with collapsible side panel
  if (isMobile && isLandscape) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden safe-area-top">
        <div className="flex-1 flex gap-1 p-1 min-h-0">
          <div className="flex-1 min-w-0" data-tour="chart">
            <TradingChart />
          </div>
          {showSidePanel && (
            <div className="w-52 flex-shrink-0 flex flex-col gap-1 overflow-y-auto scrollbar-thin animate-in slide-in-from-right-5 duration-200">
              <div data-tour="portfolio"><PortfolioSummary /></div>
              <div data-tour="trade-panel"><TradePanel /></div>
              <div data-tour="ai-signals"><AISignals /></div>
              <CollapsibleSection title="▼ Simulated Positions" count={positions.length} defaultOpen={false}>
                <Positions />
              </CollapsibleSection>
              <CollapsibleSection title="▶ Simulation History" count={trades.length} defaultOpen={false}>
                <TradeHistory />
              </CollapsibleSection>
            </div>
          )}
          <button
            onClick={() => setShowSidePanel(p => !p)}
            className="fixed bottom-3 right-3 z-[150] p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-90 transition-transform"
            style={{ minWidth: 44, minHeight: 44 }}
            title={showSidePanel ? 'Hide panel' : 'Show panel'}
          >
            {showSidePanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
        </div>
        <GuidedTour />
      </div>
    );
  }

  // Mobile portrait: simple vertical stack
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20">
          <div className="p-2 space-y-2">
            <div data-tour="portfolio"><PortfolioSummary /></div>
            <TopPerformers />
            <div className="h-[55vh] min-h-[300px]" data-tour="chart">
              <TradingChart />
            </div>
            <div data-tour="trade-panel"><TradePanel /></div>
            <div data-tour="ai-signals"><AISignals /></div>
            <div data-tour="watchlist"><Watchlist /></div>
            <CollapsibleSection title="▼ Simulated Positions" count={positions.length} defaultOpen={true}>
              <Positions />
            </CollapsibleSection>
            <CollapsibleSection title="▶ Simulation History" count={trades.length} defaultOpen={false}>
              <TradeHistory />
            </CollapsibleSection>
          </div>
        </div>
        <GuidedTour />
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        <div data-tour="portfolio"><PortfolioSummary /></div>
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="w-64 flex-shrink-0" data-tour="watchlist">
            <Watchlist />
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex-1 min-h-0" data-tour="chart">
              <TradingChart />
            </div>
            <div className="grid grid-cols-2 gap-2" style={{ height: '200px' }}>
              <Positions />
              <TradeHistory />
            </div>
          </div>
          <div className="w-72 flex-shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="flex-shrink-0" data-tour="trade-panel">
              <TradePanel />
            </div>
            <div className="flex-shrink-0" data-tour="ai-signals">
              <AISignals />
            </div>
          </div>
        </div>
      </div>
      <GuidedTour />
    </div>
  );
};

export default Index;
