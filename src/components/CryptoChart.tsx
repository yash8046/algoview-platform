import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi } from 'lightweight-charts';
import { useCryptoData } from '@/hooks/useCryptoData';
import { useCryptoStore, CRYPTO_PAIRS } from '@/stores/cryptoStore';
import { formatINR } from '@/lib/exchangeRate';

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
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (livePrice > 0) updatePositionPrice(selectedPair, livePrice);
  }, [livePrice, selectedPair]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.remove();

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

    chartInstance.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
    });
    observer.observe(chartRef.current);

    return () => { observer.disconnect(); chart.remove(); chartInstance.current = null; };
  }, [selectedPair, selectedInterval]);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    // Convert candles to INR for display
    const formatted = candles.map((c) => ({
      time: c.time as any,
      open: c.open * usdToInr,
      high: c.high * usdToInr,
      low: c.low * usdToInr,
      close: c.close * usdToInr,
    }));
    const volumes = candles.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(76, 175, 80, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));

    candleSeriesRef.current.setData(formatted);
    volumeSeriesRef.current.setData(volumes);
    chartInstance.current?.timeScale().fitContent();
  }, [candles, usdToInr]);

  const livePriceINR = livePrice * usdToInr;

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-secondary text-foreground text-xs font-mono font-semibold px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CRYPTO_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>{p.label}</option>
            ))}
          </select>

          {livePrice > 0 && (
            <span className="font-mono text-sm font-bold text-foreground">
              {formatINR(livePriceINR)}
            </span>
          )}
          {livePrice > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              (${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          )}

          {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>}
          {error && <span className="text-[10px] text-loss">{error}</span>}
        </div>

        <div className="flex gap-0.5">
          {INTERVALS.map((i) => (
            <button
              key={i.value}
              onClick={() => setSelectedInterval(i.value)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                selectedInterval === i.value
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartRef} className="flex-1 bg-chart" />
    </div>
  );
}
