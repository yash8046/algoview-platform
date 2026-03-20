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

const Index = () => {
  const { loadFromDB } = useTradingStore();

  useEffect(() => {
    loadFromDB();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
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
          <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto scrollbar-thin">
            <TradePanel />
            <div className="min-h-[350px] flex-1">
              <AISignals />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
