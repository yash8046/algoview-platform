import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { useTradingStore } from '@/stores/tradingStore';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { calculateSMA } from '@/lib/mockData';
import { calcRSI, calcMACD, calcBollingerBands, calcEMA, calcVWAP, calcSMA as calcSMALib } from '@/lib/technicalIndicators';
import ChartDrawingTools from '@/components/ChartDrawingTools';
import ChartOverlay from '@/components/ChartOverlay';
import PriceAlertPanel from '@/components/PriceAlertPanel';
import IndicatorManagerModal from '@/components/IndicatorManagerModal';
import { useChartDrawings } from '@/hooks/useChartDrawings';
import { useChartIndicators } from '@/hooks/useChartIndicators';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { detectCandlestickPatterns } from '@/lib/candlestickPatterns';
import { Maximize2, Minimize2, Magnet, X, BarChart3, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

export default function TradingChart({ minimal = false, toolbarBottom = false, toolbarLeft = false }: { minimal?: boolean; toolbarBottom?: boolean; toolbarLeft?: boolean }) {
  const navigate = useNavigate();
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
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false);
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

    // No default indicators — user adds via indicator modal

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

        // Indicators managed by indicator system, not hardcoded

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
  const fullscreenToolbarInsetStyle = isAndroid && (fullscreen || landscapeFullscreen)
    ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 0.5rem)' }
    : undefined;

  // Landscape fullscreen: minimal toolbar, chart fills entire screen
  if (landscapeFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden">
        {/* Compact landscape toolbar */}
        <div style={fullscreenToolbarInsetStyle} className="flex shrink-0 items-center justify-between px-1.5 py-0.5 bg-panel-header border-b border-border gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="font-mono text-[9px] font-semibold text-foreground truncate max-w-[80px]">
              {selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`}
            </h2>
            {loading && <span className="text-[8px] text-primary animate-pulse">...</span>}
          </div>
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin">
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
            <button
              onClick={() => setIndicatorModalOpen(true)}
              className={`p-1 rounded text-[9px] font-mono transition-all min-h-[26px] active:scale-95 ${
                indicators.length > 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
              title="Indicators"
            >
              <BarChart3 className="w-3 h-3" />
            </button>
            <IndicatorManagerModal
              open={indicatorModalOpen}
              onClose={() => setIndicatorModalOpen(false)}
              indicators={indicators}
              onToggle={toggleIndicator}
              onRemove={removeIndicator}
            />
            <PriceAlertPanel
              alerts={alerts}
              activeAlerts={activeAlerts}
              triggeredAlerts={triggeredAlerts}
              currentSymbol={selectedSymbol}
              currentPrice={currentPriceRef.current}
              onAdd={addAlert}
              onRemove={removeAlert}
              onClearTriggered={clearTriggered}
              onRequestPermission={requestNotificationPermission}
            />
            <button
              onClick={() => setMagnetMode(m => !m)}
              className={`p-1 rounded transition-colors min-h-[26px] active:scale-95 ${
                magnetMode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Magnet"
            >
              <Magnet className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-0.5 ml-0.5">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-1 py-0.5 text-[8px] font-mono rounded min-h-[26px] active:scale-95 ${
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
              className="p-1 rounded bg-loss/20 text-loss hover:bg-loss/30 active:scale-90 min-h-[26px] min-w-[26px] flex items-center justify-center ml-0.5"
              title="Exit Landscape"
            >
              <X className="w-3.5 h-3.5" />
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

  // Top toolbar: cursor, indicators, alerts, magnet (shown when toolbarLeft)
  const topToolbar = !minimal && toolbarLeft && (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary/30 border-b border-border/40 overflow-x-auto scrollbar-thin flex-shrink-0">
      <button
        onClick={() => setDrawingMode('none')}
        className={`p-1.5 rounded transition-colors min-h-[30px] min-w-[30px] flex items-center justify-center active:scale-95 ${
          drawingMode === 'none' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
        }`}
        title="Cursor"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
      </button>
      <div className="w-px h-5 bg-border/40" />
      <button
        onClick={() => setIndicatorModalOpen(true)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all min-h-[30px] active:scale-95 ${
          indicators.length > 0
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
        }`}
        title="Indicators"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span className="text-[10px]">Indicators</span>
        {indicators.length > 0 && (
          <span className="bg-primary/20 text-primary text-[8px] px-1 rounded-full font-semibold">{indicators.length}</span>
        )}
      </button>
      <IndicatorManagerModal
        open={indicatorModalOpen}
        onClose={() => setIndicatorModalOpen(false)}
        indicators={indicators}
        onToggle={toggleIndicator}
        onRemove={removeIndicator}
      />
      <PriceAlertPanel
        alerts={alerts}
        activeAlerts={activeAlerts}
        triggeredAlerts={triggeredAlerts}
        currentSymbol={selectedSymbol}
        currentPrice={currentPriceRef.current}
        onAdd={addAlert}
        onRemove={removeAlert}
        onClearTriggered={clearTriggered}
        onRequestPermission={requestNotificationPermission}
      />
      <button
        onClick={() => setMagnetMode(m => !m)}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors min-h-[30px] active:scale-95 ${
          magnetMode ? 'bg-primary/20 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
        }`}
        title="Magnet Mode"
      >
        <Magnet className="w-3.5 h-3.5" />
        <span className="text-[10px]">{magnetMode ? 'ON' : 'Magnet'}</span>
      </button>
    </div>
  );

  // Timeframe bar (shown when toolbarLeft)
  const timeframeBar = !minimal && toolbarLeft && (
    <div className="flex items-center gap-1 px-2 py-1 bg-card/50 border-b border-border/30 overflow-x-auto scrollbar-thin flex-shrink-0">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => setSelectedTimeframe(tf)}
          className={`px-2 py-1 text-[10px] font-mono rounded transition-colors min-h-[28px] whitespace-nowrap flex-shrink-0 active:scale-95 ${
            selectedTimeframe === tf
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
          }`}
        >
          {tf}
        </button>
      ))}
      <div className="flex-1" />
      {isAndroid && (
        <button
          onClick={toggleLandscapeFullscreen}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[28px] active:scale-95"
          title="Landscape Mode"
        >
          <Smartphone className="w-3.5 h-3.5 rotate-90" />
        </button>
      )}
      <button
        onClick={() => setFullscreen(f => !f)}
        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[28px] active:scale-95"
        title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );

  // Left drawing toolbar: ONLY drawing tools (when toolbarLeft)
  const leftDrawingToolbar = !minimal && toolbarLeft && (
    <div className="flex flex-col items-center gap-0.5 py-1.5 px-0.5 bg-card/80 border-r border-border/40 overflow-y-auto scrollbar-thin w-10 flex-shrink-0">
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
    </div>
  );

  const drawingToolbar = !minimal && toolbarBottom && (
    <div className="flex items-center gap-1 px-2 py-1 bg-panel-header border-t border-border overflow-x-auto scrollbar-thin">
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
      <button
        onClick={() => setIndicatorModalOpen(true)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-mono transition-all min-h-[32px] active:scale-95 ${
          indicators.length > 0
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
        }`}
        title="Indicators"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Indicators</span>
        {indicators.length > 0 && (
          <span className="bg-primary/20 text-primary text-[9px] px-1.5 rounded-full font-semibold">{indicators.length}</span>
        )}
      </button>
      <IndicatorManagerModal
        open={indicatorModalOpen}
        onClose={() => setIndicatorModalOpen(false)}
        indicators={indicators}
        onToggle={toggleIndicator}
        onRemove={removeIndicator}
      />
      <PriceAlertPanel
        alerts={alerts}
        activeAlerts={activeAlerts}
        triggeredAlerts={triggeredAlerts}
        currentSymbol={selectedSymbol}
        currentPrice={currentPriceRef.current}
        onAdd={addAlert}
        onRemove={removeAlert}
        onClearTriggered={clearTriggered}
        onRequestPermission={requestNotificationPermission}
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
    </div>
  );

  const showHeaderTools = !minimal && !toolbarBottom && !toolbarLeft;

  const chartContent = (
    <>
      {/* Header - only shown when NOT in toolbarLeft mode (ChartsPage owns the header) */}
      {!toolbarLeft && (
        <div style={fullscreenToolbarInsetStyle} className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 bg-panel-header border-b border-border gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!toolbarBottom && (
              <h2 className="font-mono text-xs sm:text-sm font-semibold text-foreground truncate">
                {selectedSymbol === 'NIFTY 50' ? 'NIFTY 50' : `${selectedSymbol}.NS`}
              </h2>
            )}
            {loading && <span className="text-[10px] text-primary animate-pulse">Loading...</span>}
            {error && <span className="text-[10px] text-loss truncate max-w-[100px]">Error</span>}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {showHeaderTools && (
              <>
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
                <button
                  onClick={() => setIndicatorModalOpen(true)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-mono transition-all min-h-[32px] active:scale-95 ${
                    indicators.length > 0
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                  }`}
                  title="Indicators"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Indicators</span>
                  {indicators.length > 0 && (
                    <span className="bg-primary/20 text-primary text-[9px] px-1.5 rounded-full font-semibold">{indicators.length}</span>
                  )}
                </button>
                <IndicatorManagerModal
                  open={indicatorModalOpen}
                  onClose={() => setIndicatorModalOpen(false)}
                  indicators={indicators}
                  onToggle={toggleIndicator}
                  onRemove={removeIndicator}
                />
                <PriceAlertPanel
                  alerts={alerts}
                  activeAlerts={activeAlerts}
                  triggeredAlerts={triggeredAlerts}
                  currentSymbol={selectedSymbol}
                  currentPrice={currentPriceRef.current}
                  onAdd={addAlert}
                  onRemove={removeAlert}
                  onClearTriggered={clearTriggered}
                  onRequestPermission={requestNotificationPermission}
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
              </>
            )}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin max-w-[120px] sm:max-w-none flex-shrink-0">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-mono rounded transition-colors min-h-[32px] whitespace-nowrap flex-shrink-0 active:scale-95 ${
                    selectedTimeframe === tf
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            {!minimal && isAndroid && (
              <button
                onClick={toggleLandscapeFullscreen}
                className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[32px] active:scale-95"
                title="Landscape Mode"
              >
                <Smartphone className="w-4 h-4 rotate-90" />
              </button>
            )}
            <button
              onClick={() => {
                if (minimal) {
                  navigate('/charts', { state: { mode: 'stocks', symbol: selectedSymbol } });
                } else {
                  setFullscreen(f => !f);
                }
              }}
              className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={minimal ? 'Open Full Chart' : fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Top toolbar row (toolbarLeft mode) */}
      {topToolbar}

      {/* Timeframe bar (toolbarLeft mode) */}
      {timeframeBar}

      {/* Loading/error indicator for toolbarLeft mode */}
      {toolbarLeft && (loading || error) && (
        <div className="px-2 py-0.5 flex-shrink-0">
          {loading && <span className="text-[10px] text-primary animate-pulse">Loading...</span>}
          {error && <span className="text-[10px] text-loss">Error loading data</span>}
        </div>
      )}

      {/* Chart + left drawing toolbar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {leftDrawingToolbar}
        <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
          <div ref={chartRef} className="absolute inset-0 bg-chart" style={{ zIndex: 1 }} />
          {!minimal && (
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
          )}
        </div>
      </div>
      {toolbarBottom && drawingToolbar}
    </>
  );

  if (fullscreen && !minimal) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden">
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
