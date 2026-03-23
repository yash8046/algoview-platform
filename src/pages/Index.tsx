import { useEffect } from 'react';
import TopBar from '@/components/TopBar';
import TradingChart from '@/components/TradingChart';
import Watchlist from '@/components/Watchlist';
import PortfolioSummary from '@/components/PortfolioSummary';
import TradePanel from '@/components/TradePanel';
import Positions from '@/components/Positions';
import TradeHistory from '@/components/TradeHistory';
import AISignals from '@/components/AISignals';
import { useTradingStore } from '@/stores/tradingStore';
import { useIsMobile } from '@/hooks/use-mobile';
import GuidedTour from '@/components/GuidedTour';

const Index = () => {
  const { loadFromDB } = useTradingStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadFromDB();
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20">
          <div className="p-2 space-y-2">
            <div data-tour="portfolio"><PortfolioSummary /></div>
            <div className="h-[280px]" data-tour="chart">
              <TradingChart />
            </div>
            <div data-tour="trade-panel"><TradePanel /></div>
            <div data-tour="ai-signals"><AISignals /></div>
            <div data-tour="watchlist"><Watchlist /></div>
            <div className="h-52"><Positions /></div>
            <div className="h-52"><TradeHistory /></div>
          </div>
        </div>
        <GuidedTour />
      </div>
    );
  }

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
