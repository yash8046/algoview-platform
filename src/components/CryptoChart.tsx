import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, type IChartApi } from 'lightweight-charts';
import { useCryptoData } from '@/hooks/useCryptoData';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { formatINR } from '@/lib/exchangeRate';
import { calcSMA, calcEMA, calcBollingerBands } from '@/lib/technicalIndicators';
import ChartDrawingTools from '@/components/ChartDrawingTools';
import ChartOverlay from '@/components/ChartOverlay';
import { useChartDrawings } from '@/hooks/useChartDrawings';
import { detectCandlestickPatterns } from '@/lib/candlestickPatterns';
import { Maximize2, Minimize2, Smartphone, X } from 'lucide-react';
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
  const sma20Ref = useRef<any>(null);
  const ema12Ref = useRef<any>(null);
  const ema26Ref = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<any>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [landscapeFullscreen, setLandscapeFullscreen] = useState(false);
  const markersRef = useRef<any>(null);
  const formattedCandlesRef = useRef<any[]>([]);
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

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
    drawings, addDrawing, clearAllDrawings, finishDrawing,
    undo, redo, canUndo, canRedo,
  } = useChartDrawings(selectedPair);

  useEffect(() => {
    if (livePrice > 0) updatePositionPrice(selectedPair, livePrice);
  }, [livePrice, selectedPair]);

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

    const sma20Series = chart.addSeries(LineSeries, { color: 'rgba(255, 193, 7, 0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ema12Series = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ema26Series = chart.addSeries(LineSeries, { color: 'rgba(156, 39, 176, 0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const bbUpperSeries = chart.addSeries(LineSeries, { color: 'rgba(128, 128, 128, 0.3)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: 'rgba(128, 128, 128, 0.3)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

    setChartApi(chart);
    setSeriesApi(candleSeries);
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20Ref.current = sma20Series;
    ema12Ref.current = ema12Series;
    ema26Ref.current = ema26Series;
    bbUpperRef.current = bbUpperSeries;
    bbLowerRef.current = bbLowerSeries;

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

  const indicators = useMemo(() => {
    if (candles.length < 26) return null;
    const closes = candles.map(c => c.close * usdToInr);
    return {
      sma20: calcSMA(closes, 20),
      ema12: calcEMA(closes, 12),
      ema26: calcEMA(closes, 26),
      bb: calcBollingerBands(closes, 20, 2),
    };
  }, [candles, usdToInr]);

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

    if (indicators) {
      const toLine = (arr: number[]) =>
        arr.map((v, i) => ({ time: candles[i].time as any, value: v })).filter(d => !isNaN(d.value));
      sma20Ref.current?.setData(toLine(indicators.sma20));
      ema12Ref.current?.setData(toLine(indicators.ema12));
      ema26Ref.current?.setData(toLine(indicators.ema26));
      bbUpperRef.current?.setData(toLine(indicators.bb.map(b => b.upper)));
      bbLowerRef.current?.setData(toLine(indicators.bb.map(b => b.lower)));
    }

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
  }, [candles, usdToInr, indicators, showPatterns, chartApi]);

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
