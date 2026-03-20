import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { generateCandlestickData, generateVolumeData, calculateSMA } from '@/lib/mockData';
import { useTradingStore } from '@/stores/tradingStore';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

export default function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const { selectedSymbol, selectedTimeframe, setSelectedTimeframe } = useTradingStore();

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0f1a' },
        textColor: '#6b7a99',
        fontSize: 12,
        fontFamily: '"JetBrains Mono", monospace',
      },
      grid: {
        vertLines: { color: 'rgba(42, 56, 89, 0.3)' },
        horzLines: { color: 'rgba(42, 56, 89, 0.3)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(38, 198, 218, 0.4)', labelBackgroundColor: '#1a2332' },
        horzLine: { color: 'rgba(38, 198, 218, 0.4)', labelBackgroundColor: '#1a2332' },
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 56, 89, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(42, 56, 89, 0.5)',
        timeVisible: true,
      },
    });

    chartInstance.current = chart;

    const candleData = generateCandlestickData(120);
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeries.setData(candleData as any);

    const volumeData = generateVolumeData(candleData);
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(volumeData as any);

    const sma20 = calculateSMA(candleData, 20);
    const sma20Series = chart.addLineSeries({ color: '#26c6da', lineWidth: 1, title: 'SMA 20' });
    sma20Series.setData(sma20 as any);

    const sma50 = calculateSMA(candleData, 50);
    const sma50Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'SMA 50' });
    sma50Series.setData(sma50 as any);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [selectedSymbol, selectedTimeframe]);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-panel-header border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-sm font-semibold text-foreground">{selectedSymbol}</h2>
          <span className="text-xs text-muted-foreground">OHLC Chart</span>
        </div>
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartRef} className="flex-1 bg-chart" />
    </div>
  );
}
