import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import TopBar from '@/components/TopBar';
import TradingChart from '@/components/TradingChart';
import Watchlist from '@/components/Watchlist';
import PortfolioSummary from '@/components/PortfolioSummary';
import TradePanel from '@/components/TradePanel';
import Positions from '@/components/Positions';
import TradeHistory from '@/components/TradeHistory';
import AISignals from '@/components/AISignals';
import TopPerformers from '@/components/TopPerformers';
import ExploreStocks from '@/components/ExploreStocks';
import MarketRegionToggle from '@/components/MarketRegionToggle';
import PullToRefresh from '@/components/PullToRefresh';
import { useTradingStore } from '@/stores/tradingStore';
import { useIsMobile } from '@/hooks/use-mobile';
import GuidedTour from '@/components/GuidedTour';
import { ChevronDown, ChevronUp, Briefcase, Clock } from 'lucide-react';

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

function CollapsibleSection({ title, icon: Icon, count, defaultOpen = false, children }: {
  title: string; icon?: any; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-card to-secondary/20 border-b border-border/30 active:bg-accent/50 transition-all"
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary/70" />}
          <span className="text-[11px] font-bold text-foreground tracking-wide uppercase">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono font-bold">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />}
      </button>
      {open && <div className="max-h-44 overflow-y-auto scrollbar-thin">{children}</div>}
    </div>
  );
}

const Index = () => {
  const { loadFromDB, positions, trades, loadUserWatchlist } = useTradingStore();
  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();

  useEffect(() => {
    loadFromDB();
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/screen-orientation').then(({ ScreenOrientation }) => {
        ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {});
      });
      return () => {
        import('@capacitor/screen-orientation').then(({ ScreenOrientation }) => {
          ScreenOrientation.unlock().catch(() => {});
        });
      };
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    // Refresh market movers + watchlist data
    const refreshExplore = (ExploreStocks as any).__refresh;
    await Promise.all([
      refreshExplore?.(),
      loadUserWatchlist(),
    ]);
  }, [loadUserWatchlist]);

  // Mobile landscape
  if (isMobile && isLandscape) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden safe-area-top bg-background">
        <div className="flex-1 flex gap-1 p-1.5 min-h-0 overflow-y-auto scrollbar-thin">
          <div className="flex-1 flex flex-col gap-1.5">
            <div data-tour="portfolio"><PortfolioSummary /></div>
            <div data-tour="trade-panel"><TradePanel /></div>
            <div data-tour="ai-signals"><AISignals /></div>
            <CollapsibleSection title="Positions" icon={Briefcase} count={positions.length} defaultOpen={false}>
              <Positions />
            </CollapsibleSection>
            <CollapsibleSection title="History" icon={Clock} count={trades.length} defaultOpen={false}>
              <TradeHistory />
            </CollapsibleSection>
          </div>
        </div>
        <GuidedTour />
      </div>
    );
  }

  // Mobile portrait
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
        <div className="flex-shrink-0 sticky top-0 z-30">
          <TopBar />
        </div>
        <PullToRefresh onRefresh={handleRefresh} className="flex-1">
          <div className="p-2.5 space-y-2.5 pb-36">
            {/* Portfolio summary + Region toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1" data-tour="portfolio"><PortfolioSummary /></div>
            </div>

            {/* Region toggle row */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Market</span>
              <MarketRegionToggle />
            </div>

            {/* Market movers (dynamic gainers + losers) */}
            <ExploreStocks />

            {/* Watchlist movers */}
            <TopPerformers />

            {/* Chart */}
            <div className="h-[220px] rounded-xl overflow-hidden border border-border/30 shadow-lg shadow-black/10" data-tour="chart">
              <TradingChart minimal />
            </div>

            {/* Simulate trade panel */}
            <div data-tour="trade-panel"><TradePanel /></div>

            {/* AI Analysis */}
            <div data-tour="ai-signals"><AISignals /></div>

            {/* Watchlist */}
            <div data-tour="watchlist"><Watchlist /></div>

            {/* Positions & History */}
            <CollapsibleSection title="Positions" icon={Briefcase} count={positions.length} defaultOpen={true}>
              <Positions />
            </CollapsibleSection>
            <CollapsibleSection title="Trade History" icon={Clock} count={trades.length} defaultOpen={false}>
              <TradeHistory />
            </CollapsibleSection>
          </div>
        </PullToRefresh>
        <GuidedTour />
      </div>
    );
  }

  // Desktop — premium layout
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <TopBar />

      <div className="flex-1 flex flex-col gap-2 p-2.5 overflow-hidden">
        {/* Portfolio summary + region toggle */}
        <div className="flex items-center gap-3">
          <div className="flex-1" data-tour="portfolio"><PortfolioSummary /></div>
          <MarketRegionToggle />
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-2.5 min-h-0">
          {/* Left: Watchlist */}
          <div className="w-64 flex-shrink-0" data-tour="watchlist">
            <Watchlist />
          </div>

          {/* Center: Chart + bottom panels */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-border/30 shadow-lg shadow-black/10" data-tour="chart">
              <TradingChart minimal />
            </div>
            <div className="grid grid-cols-2 gap-2.5 flex-shrink-0" style={{ maxHeight: '180px' }}>
              <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
                <Positions />
              </div>
              <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden shadow-lg shadow-black/5">
                <TradeHistory />
              </div>
            </div>
          </div>

          {/* Right: Trade + AI */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-2.5 min-h-0 overflow-y-auto scrollbar-thin">
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
