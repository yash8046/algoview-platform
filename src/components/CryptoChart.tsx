import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, type IChartApi } from 'lightweight-charts';
import { useCryptoData } from '@/hooks/useCryptoData';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { formatINR } from '@/lib/exchangeRate';
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

const INTERVALS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
];

export default function CryptoChart() {
  const { selectedPair, selectedInterval, setSelectedPair, setSelectedInterval, updatePositionPrice, usdToInr } = useCryptoStore();
  const { candles, livePrice, loading, error } = useCryptoData(selectedPair, selectedInterval);
  const chartRef = useRef<HTMLDivElement>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<any>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [landscapeFullscreen, setLandscapeFullscreen] = useState(false);
  const markersRef = useRef<any>(null);
  const formattedCandlesRef = useRef<any[]>([]);
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [magnetMode, setMagnetMode] = useState(false);

  const { indicators: overlayIndicators, toggleIndicator, removeIndicator } = useChartIndicators();
  const { alerts, activeAlerts, triggeredAlerts, addAlert, removeAlert, clearTriggered, checkAlerts, requestNotificationPermission } = usePriceAlerts();
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false);

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
      console.warn('[CryptoChart] Screen orientation failed:', err);
      setFullscreen(f => !f);
    }
  };

  const {
    drawingMode, setDrawingMode, drawingModeRef,
    drawings, addDrawing, removeDrawing, clearAllDrawings, finishDrawing,
    undo, redo, canUndo, canRedo,
  } = useChartDrawings(selectedPair);

  useEffect(() => {
    if (livePrice > 0) {
      updatePositionPrice(selectedPair, livePrice);
      checkAlerts(selectedPair, livePrice * usdToInr);
    }
  }, [livePrice, selectedPair, usdToInr]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: 'hsl(222, 47%, 5%)' },
        textColor: 'hsl(215, 15%, 50%)',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'hsl(222, 30%, 12%)' },
        horzLines: { color: 'hsl(222, 30%, 12%)' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'hsl(222, 30%, 18%)' },
      timeScale: { borderColor: 'hsl(222, 30%, 18%)', timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: 'hsl(142, 71%, 45%)', downColor: 'hsl(0, 72%, 51%)',
      borderUpColor: 'hsl(142, 71%, 45%)', borderDownColor: 'hsl(0, 72%, 51%)',
      wickUpColor: 'hsl(142, 71%, 45%)', wickDownColor: 'hsl(0, 72%, 51%)',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // No default indicator lines — user adds via modal

    setChartApi(chart);
    setSeriesApi(candleSeries);
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    // Indicator refs no longer needed — managed by indicator system

    const observer = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      setChartApi(null);
      setSeriesApi(null);
    };
  }, [selectedPair, selectedInterval, fullscreen]);

  // Dynamic indicator series management
  const indicatorSeriesRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!chartApi || candles.length === 0) return;
    const closes = candles.map(c => c.close * usdToInr);
    const candleData = candles.map(c => ({
      time: c.time, open: c.open * usdToInr, high: c.high * usdToInr,
      low: c.low * usdToInr, close: c.close * usdToInr, volume: c.volume,
    }));
    const activeIds = new Set(overlayIndicators.map(i => i.id));

    indicatorSeriesRef.current.forEach((s, id) => {
      if (!activeIds.has(id)) {
        try { chartApi.removeSeries(s); } catch {}
        indicatorSeriesRef.current.delete(id);
      }
    });

    for (const ind of overlayIndicators) {
      if (indicatorSeriesRef.current.has(ind.id)) continue;
      try {
        if (ind.type === 'sma' || ind.type === 'ema') {
          const vals = ind.type === 'sma' ? calcSMALib(closes, ind.period || 20) : calcEMA(closes, ind.period || 12);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: `${ind.type.toUpperCase()} ${ind.period || ''}` });
          s.setData(vals.map((v: number, i: number) => ({ time: candles[i].time as any, value: v })).filter((d: any) => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'bollinger') {
          const bb = calcBollingerBands(closes, ind.period || 20);
          const sU = chartApi.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'BB Upper' });
          const sL = chartApi.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'BB Lower' });
          sU.setData(bb.map((b: any, i: number) => ({ time: candles[i].time as any, value: b.upper })).filter((d: any) => !isNaN(d.value)));
          sL.setData(bb.map((b: any, i: number) => ({ time: candles[i].time as any, value: b.lower })).filter((d: any) => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, sU);
          indicatorSeriesRef.current.set(ind.id + '_lower', sL);
        } else if (ind.type === 'vwap') {
          const vwap = calcVWAP(candleData);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: 'VWAP' });
          s.setData(vwap.map((v: number, i: number) => ({ time: candles[i].time as any, value: v })).filter((d: any) => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'rsi') {
          const rsi = calcRSI(closes, 14);
          const s = chartApi.addSeries(LineSeries, { color: ind.color, lineWidth: 1, title: 'RSI', priceScaleId: 'rsi' });
          s.priceScale().applyOptions({ scaleMargins: { top: 0.7, bottom: 0.05 } });
          s.setData(rsi.map((v: number, i: number) => ({ time: candles[i].time as any, value: v })).filter((d: any) => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
        } else if (ind.type === 'macd') {
          const macd = calcMACD(closes);
          const s = chartApi.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'MACD', priceScaleId: 'macd' });
          s.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
          const sSignal = chartApi.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Signal', priceScaleId: 'macd' });
          s.setData(macd.map((m: any, i: number) => ({ time: candles[i].time as any, value: m.macd })).filter((d: any) => !isNaN(d.value)));
          sSignal.setData(macd.map((m: any, i: number) => ({ time: candles[i].time as any, value: m.signal })).filter((d: any) => !isNaN(d.value)));
          indicatorSeriesRef.current.set(ind.id, s);
          indicatorSeriesRef.current.set(ind.id + '_signal', sSignal);
        }
      } catch (err) {
        console.error('Crypto indicator error:', ind.type, err);
      }
    }
  }, [overlayIndicators, chartApi, candles, usdToInr]);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const formatted = candles.map((c) => ({
      time: c.time as any,
      open: c.open * usdToInr, high: c.high * usdToInr,
      low: c.low * usdToInr, close: c.close * usdToInr,
    }));
    const volumes = candles.map((c) => ({
      time: c.time as any, value: c.volume,
      color: c.close >= c.open ? 'rgba(76, 175, 80, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));

    candleSeriesRef.current.setData(formatted);
    volumeSeriesRef.current.setData(volumes);
    formattedCandlesRef.current = formatted;

    // Indicators managed by overlay system, not hardcoded

    if (markersRef.current) {
      markersRef.current.detach();
      markersRef.current = null;
    }
    if (showPatterns && formatted.length > 2) {
      const markers = detectCandlestickPatterns(formatted);
      if (markers.length > 0) {
        markersRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
      }
    }

    chartApi?.timeScale().fitContent();
  }, [candles, usdToInr, showPatterns, chartApi]);

  const livePriceINR = livePrice * usdToInr;
  const isDrawingActive = drawingMode !== 'none';

  // Landscape fullscreen: ONLY chart + compact toolbar, nothing else
  if (landscapeFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col">
        <div className="flex items-center justify-between px-2 py-1 bg-panel-header border-b border-border">
          <div className="flex items-center gap-2">
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="bg-secondary text-foreground text-[10px] font-mono font-semibold px-1.5 py-1 rounded border border-border min-h-[28px]"
            >
              {CRYPTO_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>{p.label}</option>
              ))}
            </select>
            {livePrice > 0 && (
              <span className="font-mono text-[10px] font-bold text-foreground">{formatINR(livePriceINR)}</span>
            )}
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
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setSelectedInterval(i.value)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono rounded min-h-[28px] active:scale-95 ${
                    selectedInterval === i.value
                      ? 'bg-primary/20 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {i.label}
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
              candleData={formattedCandlesRef.current}
            />
          </div>
        </div>
      </div>
    );
  }

  const chartContent = (
    <>
      <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-panel-header border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-secondary text-foreground text-xs font-mono font-semibold px-2 py-1.5 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary min-h-[32px]"
          >
            {CRYPTO_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>{p.label}</option>
            ))}
          </select>
          {livePrice > 0 && (
            <span className="font-mono text-xs sm:text-sm font-bold text-foreground">{formatINR(livePriceINR)}</span>
          )}
          {livePrice > 0 && (
            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">
              (${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          )}
          {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>}
          {error && <span className="text-[10px] text-loss">{error}</span>}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
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
              overlayIndicators.length > 0
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
            title="Indicators"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Indicators</span>
            {overlayIndicators.length > 0 && (
              <span className="bg-primary/20 text-primary text-[9px] px-1.5 rounded-full font-semibold">{overlayIndicators.length}</span>
            )}
          </button>
          <IndicatorManagerModal
            open={indicatorModalOpen}
            onClose={() => setIndicatorModalOpen(false)}
            indicators={overlayIndicators}
            onToggle={toggleIndicator}
            onRemove={removeIndicator}
          />
          <PriceAlertPanel
            alerts={alerts}
            activeAlerts={activeAlerts}
            triggeredAlerts={triggeredAlerts}
            currentSymbol={selectedPair}
            currentPrice={livePriceINR}
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
          <div className="flex gap-0.5">
            {INTERVALS.map((i) => (
              <button
                key={i.value}
                onClick={() => setSelectedInterval(i.value)}
                className={`px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-mono rounded transition-colors min-h-[32px] active:scale-95 ${
                  selectedInterval === i.value
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
          {isAndroid && (
            <button
              onClick={toggleLandscapeFullscreen}
              className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[32px] active:scale-95"
              title="Landscape Mode"
            >
              <Smartphone className="w-4 h-4 rotate-90" />
            </button>
          )}
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
              candleData={formattedCandlesRef.current}
            />
        </div>
      </div>
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col">
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
