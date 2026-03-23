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
            <PortfolioSummary />
            <div className="h-[280px]">
              <TradingChart />
            </div>
            <TradePanel />
            <AISignals />
            <Watchlist />
            <div className="h-52"><Positions /></div>
            <div className="h-52"><TradeHistory /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <TopBar />
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        <PortfolioSummary />
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="w-64 flex-shrink-0">
            <Watchlist />
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex-1 min-h-0">
              <TradingChart />
            </div>
            <div className="grid grid-cols-2 gap-2" style={{ height: '200px' }}>
              <Positions />
              <TradeHistory />
            </div>
          </div>
          <div className="w-72 flex-shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
            <div className="flex-shrink-0">
              <TradePanel />
            </div>
            <div className="flex-shrink-0">
              <AISignals />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
