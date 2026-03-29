import { useTradingStore } from '@/stores/tradingStore';

export default function MarketRegionToggle() {
  const { marketRegion, setMarketRegion } = useTradingStore();

  return (
    <button
      onClick={() => setMarketRegion(marketRegion === 'IN' ? 'US' : 'IN')}
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 border border-border/50 hover:bg-secondary transition-all active:scale-95"
      title={`Switch to ${marketRegion === 'IN' ? 'US' : 'Indian'} market`}
    >
      <span className="text-sm leading-none">{marketRegion === 'IN' ? '🇮🇳' : '🇺🇸'}</span>
      <span className="text-[9px] font-mono font-bold text-foreground">
        {marketRegion === 'IN' ? 'NSE' : 'NYSE'}
      </span>
    </button>
  );
}
