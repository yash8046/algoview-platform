import { useState, useCallback, useRef, useEffect } from 'react';
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

export function useChartDrawings(symbol: string) {
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const drawingModeRef = useRef<DrawingMode>('none');
  const [drawings, setDrawings] = useState<DrawingLine[]>(() => loadDrawings(symbol));

  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    setDrawings(loadDrawings(symbol));
  }, [symbol]);

  useEffect(() => {
    saveDrawings(symbol, drawings);
  }, [drawings, symbol]);

  const addDrawing = useCallback((d: DrawingLine) => {
    setDrawings((prev) => [...prev, d]);
  }, []);

  const clearAllDrawings = useCallback(() => {
    setDrawings([]);
  }, []);

  const finishDrawing = useCallback(() => {
    // Keep the current drawing mode active so the user can draw multiple
    // shapes without reselecting. Only laser resets automatically.
    setDrawingMode((prev) => (prev === 'laser' ? 'none' : prev));
  }, []);

  return {
    drawingMode,
    setDrawingMode,
    drawingModeRef,
    drawings,
    addDrawing,
    clearAllDrawings,
    finishDrawing,
  };
}
