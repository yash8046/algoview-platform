import { useState, useCallback, useRef, useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { DrawingMode, DrawingLine } from '@/components/ChartDrawingTools';

const STORAGE_KEY = 'chart_drawings';

function loadDrawings(symbol: string): DrawingLine[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${symbol}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDrawings(symbol: string, drawings: DrawingLine[]) {
  localStorage.setItem(`${STORAGE_KEY}_${symbol}`, JSON.stringify(drawings));
}

export function useChartDrawings(symbol: string, chart: IChartApi | null) {
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [drawings, setDrawings] = useState<DrawingLine[]>(() => loadDrawings(symbol));
  const priceLineRefs = useRef<Map<string, any>>(new Map());
  const trendlineStartRef = useRef<{ time: number; price: number } | null>(null);

  // Reload drawings when symbol changes
  useEffect(() => {
    setDrawings(loadDrawings(symbol));
  }, [symbol]);

  // Save drawings when they change
  useEffect(() => {
    saveDrawings(symbol, drawings);
  }, [drawings, symbol]);

  const addHorizontalLine = useCallback(
    (price: number, series: any) => {
      if (!series) return;
      const id = `hline_${Date.now()}`;
      const color = '#f59e0b';

      const priceLine = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'H-Line',
      });

      priceLineRefs.current.set(id, { priceLine, series });

      const newLine: DrawingLine = { id, type: 'hline', price, color };
      setDrawings((prev) => [...prev, newLine]);
      setDrawingMode('none');
    },
    []
  );

  const clearAllDrawings = useCallback(() => {
    priceLineRefs.current.forEach(({ priceLine, series }) => {
      try {
        series.removePriceLine(priceLine);
      } catch {}
    });
    priceLineRefs.current.clear();
    setDrawings([]);
  }, []);

  // Restore horizontal lines on chart rebuild
  const restoreDrawings = useCallback(
    (series: any) => {
      priceLineRefs.current.clear();
      drawings.forEach((d) => {
        if (d.type === 'hline' && d.price && series) {
          const priceLine = series.createPriceLine({
            price: d.price,
            color: d.color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'H-Line',
          });
          priceLineRefs.current.set(d.id, { priceLine, series });
        }
      });
    },
    [drawings]
  );

  return {
    drawingMode,
    setDrawingMode,
    drawings,
    addHorizontalLine,
    clearAllDrawings,
    restoreDrawings,
  };
}
