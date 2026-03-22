import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { useTradingStore } from '@/stores/tradingStore';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { calculateSMA } from '@/lib/mockData';
import ChartDrawingTools from '@/components/ChartDrawingTools';
import ChartOverlay from '@/components/ChartOverlay';
import { useChartDrawings } from '@/hooks/useChartDrawings';
import { detectCandlestickPatterns } from '@/lib/candlestickPatterns';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

export default function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { selectedSymbol, selectedTimeframe, setSelectedTimeframe, updatePrice } = useTradingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<any>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const markersRef = useRef<any>(null);
  const candleDataRef = useRef<any[]>([]);

  const {
    drawingMode, setDrawingMode, drawingModeRef,
    drawings, addDrawing, clearAllDrawings, finishDrawing,
  } = useChartDrawings(selectedSymbol);

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
      rightPriceScale: { borderColor: 'rgba(42, 56, 89, 0.5)' },
      timeScale: { borderColor: 'rgba(42, 56, 89, 0.5)', timeVisible: true },
      localization: { priceFormatter: (p: number) => '₹' + p.toFixed(2) },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderDownColor: '#ef4444', borderUpColor: '#22c55e',
      wickDownColor: '#ef4444', wickUpColor: '#22c55e',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const sma20Series = chart.addSeries(LineSeries, { color: '#26c6da', lineWidth: 1, title: 'SMA 20' });
    const sma50Series = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'SMA 50' });

    setChartApi(chart);
    setSeriesApi(candleSeries);

    setLoading(true);
    setError(null);

    fetchYahooFinanceData(selectedSymbol, selectedTimeframe)
      .then((resp) => {
        const candleData = resp.candles.map(c => ({
          time: c.time as any,
          open: +c.open.toFixed(2), high: +c.high.toFixed(2),
          low: +c.low.toFixed(2), close: +c.close.toFixed(2),
        }));
        const volData = resp.candles.map(c => ({
          time: c.time as any, value: c.volume,
          color: c.close >= c.open ? 'rgba(38, 166, 91, 0.3)' : 'rgba(239, 83, 80, 0.3)',
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volData);
        candleDataRef.current = candleData;

        if (candleData.length >= 20) sma20Series.setData(calculateSMA(candleData, 20) as any);
        if (candleData.length >= 50) sma50Series.setData(calculateSMA(candleData, 50) as any);

        chart.timeScale().fitContent();

        if (resp.regularMarketPrice) {
          updatePrice(selectedSymbol, resp.regularMarketPrice, resp.previousClose || resp.regularMarketPrice);
        } else if (candleData.length > 0) {
          const last = candleData[candleData.length - 1];
          updatePrice(selectedSymbol, last.close, resp.previousClose || last.open);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Chart data error:', err);
        setError(err.message);
        setLoading(false);
      });

    const observer = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
      }
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      setChartApi(null);
      setSeriesApi(null);
    };
  }, [selectedSymbol, selectedTimeframe]);

  // Apply candlestick pattern markers
  useEffect(() => {
    if (!seriesApi || candleDataRef.current.length === 0) return;
    // Clean up previous markers
    if (markersRef.current) {
      markersRef.current.detach();
      markersRef.current = null;
    }
    if (showPatterns) {
      const markers = detectCandlestickPatterns(candleDataRef.current);
      if (markers.length > 0) {
        markersRef.current = createSeriesMarkers(seriesApi, markers);
      }
    }
  }, [showPatterns, seriesApi]);

  const isDrawingActive = drawingMode !== 'none';

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 bg-panel-header border-b border-border gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="font-mono text-xs sm:text-sm font-semibold text-foreground truncate">
            {selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`}
          </h2>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">NSE</span>
          {loading && <span className="text-[10px] text-primary animate-pulse">Loading...</span>}
          {error && <span className="text-[10px] text-loss truncate max-w-[100px]">Error</span>}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <ChartDrawingTools
            activeMode={drawingMode}
            onModeChange={setDrawingMode}
            drawings={drawings}
            onClearAll={clearAllDrawings}
            showPatterns={showPatterns}
            onTogglePatterns={() => setShowPatterns(p => !p)}
          />
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-mono rounded transition-colors min-h-[32px] active:scale-95 ${
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
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={chartRef} className="absolute inset-0 bg-chart" style={{ zIndex: 1 }} />
        <div className="absolute inset-0" style={{ zIndex: isDrawingActive ? 100 : 0, pointerEvents: isDrawingActive ? 'auto' : 'none' }}>
          <ChartOverlay
            chart={chartApi}
            series={seriesApi}
            drawingMode={drawingMode}
            drawingModeRef={drawingModeRef}
            drawings={drawings}
            onAddDrawing={addDrawing}
            onFinishDrawing={finishDrawing}
          />
        </div>
      </div>
    </div>
  );
}
