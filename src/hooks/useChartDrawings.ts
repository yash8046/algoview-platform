import { useState, useCallback, useRef, useEffect } from 'react';
import type { DrawingMode, DrawingLine } from '@/components/ChartDrawingTools';

const STORAGE_KEY = 'chart_drawings';
const MAX_UNDO = 50;

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
  const undoStack = useRef<DrawingLine[][]>([]);
  const redoStack = useRef<DrawingLine[][]>([]);

  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    const loaded = loadDrawings(symbol);
    setDrawings(loaded);
    undoStack.current = [];
    redoStack.current = [];
  }, [symbol]);

  useEffect(() => {
    saveDrawings(symbol, drawings);
  }, [drawings, symbol]);

  const pushUndo = useCallback((prev: DrawingLine[]) => {
    undoStack.current = [...undoStack.current.slice(-MAX_UNDO), prev];
    redoStack.current = [];
  }, []);

  const addDrawing = useCallback((d: DrawingLine) => {
    setDrawings((prev) => {
      pushUndo(prev);
      return [...prev, d];
    });
  }, [pushUndo]);

  const clearAllDrawings = useCallback(() => {
    setDrawings((prev) => {
      pushUndo(prev);
      return [];
    });
  }, [pushUndo]);

  const removeDrawing = useCallback((id: string) => {
    setDrawings((prev) => {
      pushUndo(prev);
      return prev.filter(d => d.id !== id);
    });
  }, [pushUndo]);

  // updateDrawing WITH undo support (for drag completion)
  const updateDrawing = useCallback((id: string, updates: Partial<DrawingLine>) => {
    setDrawings((prev) => {
      const idx = prev.findIndex(d => d.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  }, []);

  // Commit undo snapshot after drag ends (call this on pointerUp)
  const commitDragUndo = useCallback((snapshotBeforeDrag: DrawingLine[]) => {
    undoStack.current = [...undoStack.current.slice(-MAX_UNDO), snapshotBeforeDrag];
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setDrawings((current) => {
      redoStack.current.push(current);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    setDrawings((current) => {
      undoStack.current.push(current);
      return next;
    });
  }, []);

  const finishDrawing = useCallback(() => {
    // After drawing completion, switch to select mode so user can immediately reposition
    setDrawingMode('none');
  }, []);

  return {
    drawingMode,
    setDrawingMode,
    drawingModeRef,
    drawings,
    addDrawing,
    removeDrawing,
    updateDrawing,
    commitDragUndo,
    clearAllDrawings,
    finishDrawing,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
