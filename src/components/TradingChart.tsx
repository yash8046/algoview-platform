import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { useTradingStore } from '@/stores/tradingStore';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { calculateSMA } from '@/lib/mockData';
import { calcRSI, calcMACD, calcBollingerBands, calcEMA, calcVWAP, calcSMA as calcSMALib } from '@/lib/technicalIndicators';
import ChartDrawingTools from '@/components/ChartDrawingTools';
import ChartIndicatorOverlay from '@/components/ChartIndicatorOverlay';
import ChartOverlay from '@/components/ChartOverlay';
import PriceAlertPanel from '@/components/PriceAlertPanel';
import { useChartDrawings } from '@/hooks/useChartDrawings';
import { useChartIndicators } from '@/hooks/useChartIndicators';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { detectCandlestickPatterns } from '@/lib/candlestickPatterns';
import { Maximize2, Minimize2, Magnet, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

export default function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { selectedSymbol, selectedTimeframe, setSelectedTimeframe, updatePrice } = useTradingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<any>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [landscapeFullscreen, setLandscapeFullscreen] = useState(false);
  const markersRef = useRef<any>(null);
  const candleDataRef = useRef<any[]>([]);
  const rawCandlesRef = useRef<any[]>([]);
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [magnetMode, setMagnetMode] = useState(false);

  const exitLandscape = async () => {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.unlock();
    } catch {}
    setLandscapeFullscreen(false);
    setFullscreen(false);
  };

  const toggleLandscapeFullscreen = async () => {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      if (!landscapeFullscreen) {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        setLandscapeFullscreen(true);
        setFullscreen(true);
      } else {
        await exitLandscape();
      }
    } catch (err) {
      console.warn('[Chart] Screen orientation failed:', err);
      setFullscreen(f => !f);
    }
  };

  const {
    drawingMode, setDrawingMode, drawingModeRef,
    drawings, addDrawing, removeDrawing, clearAllDrawings, finishDrawing,
    undo, redo, canUndo, canRedo,
  } = useChartDrawings(selectedSymbol);

  const { indicators, toggleIndicator, removeIndicator } = useChartIndicators();
  const { alerts, activeAlerts, triggeredAlerts, addAlert, removeAlert, clearTriggered, checkAlerts, requestNotificationPermission } = usePriceAlerts();
  const currentPriceRef = useRef(0);

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
        rawCandlesRef.current = resp.candles.map(c => ({
          time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));

        if (candleData.length >= 20) sma20Series.setData(calculateSMA(candleData, 20) as any);
        if (candleData.length >= 50) sma50Series.setData(calculateSMA(candleData, 50) as any);

        chart.timeScale().fitContent();

        if (resp.regularMarketPrice) {
          updatePrice(selectedSymbol, resp.regularMarketPrice, resp.previousClose || resp.regularMarketPrice);
          currentPriceRef.current = resp.regularMarketPrice;
          checkAlerts(selectedSymbol, resp.regularMarketPrice);
        } else if (candleData.length > 0) {
          const last = candleData[candleData.length - 1];
          updatePrice(selectedSymbol, last.close, resp.previousClose || last.open);
          currentPriceRef.current = last.close;
          checkAlerts(selectedSymbol, last.close);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Chart data error:', err);
        setError(err.message);
        setLoading(false);
      });

    const resizeChart = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
      }
    };

    const observer = new ResizeObserver(resizeChart);
    observer.observe(chartRef.current);

    window.addEventListener('orientationchange', () => setTimeout(resizeChart, 200));

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', resizeChart);
      chart.remove();
      setChartApi(null);
      setSeriesApi(null);
    };
  }, [selectedSymbol, selectedTimeframe, fullscreen]);

  // Apply candlestick pattern markers
  useEffect(() => {
    if (!seriesApi || candleDataRef.current.length === 0) return;
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

  // Manage indicator series
  useEffect(() => {
    if (!chartApi || rawCandlesRef.current.length === 0) return;
    const candles = rawCandlesRef.current;
    const closes = candles.map((c: any) => c.close);
    const activeIds = new Set(indicators.map(i => i.id));

    // Remove old series
    indicatorSeriesRef.current.forEach((s, id) => {
      if (!activeIds.has(id)) {
        try { chartApi.removeSeries(s); } catch {}
        indicatorSeriesRef.current.delete(id);
      }
    });

    // Add/update indicator series
    for (const ind of indicators) {
      if (indicatorSeriesRef.current.has(ind.id)) continue;
      try {
        if (ind.type === 'sma' || ind.type === 'ema') {
          const vals = ind.type === 'sma' ? calcSMALib(closes, ind.period || 20) : calcEMA(closes, ind.period || 12);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: `${ind.type.toUpperCase()} ${ind.period || ''}` });
          const data = vals.map((v, i) => ({ time: candles[i].time as any, value: v })).filter(d => !isNaN(d.value));
          s.setData(data);
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'bollinger') {
          const bb = calcBollingerBands(closes, ind.period || 20);
          const sU = chartApi.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'BB Upper' });
          const sL = chartApi.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'BB Lower' });
          sU.setData(bb.map((b, i) => ({ time: candles[i].time as any, value: b.upper })).filter(d => !isNaN(d.value)));
          sL.setData(bb.map((b, i) => ({ time: candles[i].time as any, value: b.lower })).filter(d => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, sU);
          indicatorSeriesRef.current.set(ind.id + '_lower', sL);
        } else if (ind.type === 'vwap') {
          const vwap = calcVWAP(candles);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: 'VWAP' });
          s.setData(vwap.map((v, i) => ({ time: candles[i].time as any, value: v })).filter(d => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'rsi') {
          // RSI rendered as separate pane via price scale
          const rsi = calcRSI(closes, 14);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: 'RSI', priceScaleId: 'rsi' });
          s.priceScale().applyOptions({ scaleMargins: { top: 0.7, bottom: 0.05 } });
          s.setData(rsi.map((v, i) => ({ time: candles[i].time as any, value: v })).filter(d => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'macd') {
          const macd = calcMACD(closes);
          const s = chartApi.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'MACD', priceScaleId: 'macd' });
          s.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
          const sSignal = chartApi.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Signal', priceScaleId: 'macd' });
          s.setData(macd.map((m, i) => ({ time: candles[i].time as any, value: m.macd })).filter(d => !isNaN(d.value)));
          sSignal.setData(macd.map((m, i) => ({ time: candles[i].time as any, value: m.signal })).filter(d => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
          indicatorSeriesRef.current.set(ind.id + '_signal', sSignal);
        }
      } catch (err) {
        console.error('Indicator error:', ind.type, err);
      }
    }
  }, [indicators, chartApi]);

  const isDrawingActive = drawingMode !== 'none';

  // Landscape fullscreen: minimal toolbar, chart fills entire screen
  if (landscapeFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col">
        {/* Compact landscape toolbar */}
        <div className="flex items-center justify-between px-2 py-1 bg-panel-header border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-[10px] font-semibold text-foreground">
              {selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`}
            </h2>
            {loading && <span className="text-[9px] text-primary animate-pulse">Loading...</span>}
          </div>
          <div className="flex items-center gap-1">
            <ChartDrawingTools
              activeMode={drawingMode}
              onModeChange={setDrawingMode}
              drawings={drawings}
              onClearAll={clearAllDrawings}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              showPatterns={showPatterns}
              onTogglePatterns={() => setShowPatterns(p => !p)}
            />
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono rounded min-h-[28px] active:scale-95 ${
                    selectedTimeframe === tf
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <button
              onClick={exitLandscape}
              className="p-1.5 rounded bg-loss/20 text-loss hover:bg-loss/30 active:scale-90 min-h-[28px] min-w-[28px] flex items-center justify-center ml-1"
              title="Exit Landscape"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Chart fills remaining space */}
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
              onRemoveDrawing={removeDrawing}
              onFinishDrawing={finishDrawing}
              magnetMode={magnetMode}
              candleData={candleDataRef.current}
            />
          </div>
        </div>
      </div>
    );
  }

  const chartContent = (
    <>
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
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            showPatterns={showPatterns}
            onTogglePatterns={() => setShowPatterns(p => !p)}
          />
          <ChartIndicatorOverlay
            indicators={indicators}
            onToggle={toggleIndicator}
            onRemove={removeIndicator}
          />
          <button
            onClick={() => setMagnetMode(m => !m)}
            className={`p-1.5 rounded transition-colors min-h-[32px] active:scale-95 ${
              magnetMode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            title="Magnet Mode (snap to OHLC)"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
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
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
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
            onRemoveDrawing={removeDrawing}
              onFinishDrawing={finishDrawing}
              magnetMode={magnetMode}
              candleData={candleDataRef.current}
            />
        </div>
      </div>
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col safe-area-top">
        <div className="h-[env(safe-area-inset-top,36px)] min-h-[36px] bg-background flex-shrink-0" />
        {chartContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {chartContent}
    </div>
  );
}
