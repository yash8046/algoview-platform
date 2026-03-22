import { useEffect, useRef, useCallback } from 'react';
import type { IChartApi, Time } from 'lightweight-charts';
import type { DrawingMode, DrawingLine } from './ChartDrawingTools';

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_EXT_LEVELS = [0, 0.618, 1, 1.382, 1.618, 2, 2.618];
const FIB_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

interface ChartOverlayProps {
  chart: IChartApi | null;
  series: any;
  drawingMode: DrawingMode;
  drawingModeRef: React.MutableRefObject<DrawingMode>;
  drawings: DrawingLine[];
  onAddDrawing: (drawing: DrawingLine) => void;
  onFinishDrawing: () => void;
}

export default function ChartOverlay({ chart, series, drawingMode, drawingModeRef, drawings, onAddDrawing, onFinishDrawing }: ChartOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const startCoord = useRef<{ time: Time; price: number } | null>(null);
  const currentPixel = useRef<{ x: number; y: number } | null>(null);
  const penCoords = useRef<{ time: Time; price: number }[]>([]);
  const laserPixels = useRef<{ x: number; y: number; t: number }[]>([]);
  const laserRaf = useRef<number>(0);

  const toPixel = useCallback((time: Time, price: number) => {
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(time);
    const y = series.priceToCoordinate(price);
    if (x === null || y === null) return null;
    return { x, y };
  }, [chart, series]);

  const fromPixel = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time === null || price === null) return null;
    return { time, price, x, y };
  }, [chart, series]);

  const renderHLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (d.price == null || !series) return;
    const y = series.priceToCoordinate(d.price);
    if (y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = d.color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(d.price.toFixed(2), 4, y - 4);
  }, [series]);

  const renderVLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, h: number) => {
    if (!d.points?.[0] || !chart) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    if (x === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [chart]);

  const renderTrendline = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    [p1, p2].forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    });
  }, [toPixel]);

  const renderFib = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2 || !series) return;
    const fp1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const fp2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!fp1 || !fp2) return;
    const levels = d.type === 'fib_extension' ? FIB_EXT_LEVELS : FIB_LEVELS;
    const priceDiff = d.points[1].price - d.points[0].price;
    const minX = Math.min(fp1.x, fp2.x);
    const maxX = Math.max(fp1.x, fp2.x);
    levels.forEach((level, idx) => {
      const price = d.points![0].price + priceDiff * level;
      const y = series.priceToCoordinate(price);
      if (y === null) return;
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length];
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 2]);
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = FIB_COLORS[idx % FIB_COLORS.length];
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${(level * 100).toFixed(1)}% ${price.toFixed(2)}`, minX + 4, y - 3);
    });
  }, [series, toPixel]);

  const renderRectangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const rx = Math.min(p1.x, p2.x);
    const ry = Math.min(p1.y, p2.y);
    const rw = Math.abs(p2.x - p1.x);
    const rh = Math.abs(p2.y - p1.y);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = d.color;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }, [toPixel]);

  const renderPen = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
  }, [toPixel]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const d of drawings) {
      switch (d.type) {
        case 'hline': renderHLine(ctx, d, rect.width); break;
        case 'vline': renderVLine(ctx, d, rect.height); break;
        case 'trendline': renderTrendline(ctx, d); break;
        case 'fib_retracement':
        case 'fib_extension': renderFib(ctx, d); break;
        case 'rectangle': renderRectangle(ctx, d); break;
        case 'pen': renderPen(ctx, d); break;
      }
    }

    // In-progress preview
    if (isDrawing.current && startCoord.current && currentPixel.current) {
      const sp = toPixel(startCoord.current.time, startCoord.current.price);
      if (sp) {
        const cp = currentPixel.current;
        const mode = drawingModeRef.current;
        ctx.globalAlpha = 0.6;
        if (mode === 'trendline') {
          ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
          ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        } else if (mode === 'rectangle') {
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.strokeRect(Math.min(sp.x, cp.x), Math.min(sp.y, cp.y), Math.abs(cp.x - sp.x), Math.abs(cp.y - sp.y));
        } else if (mode === 'fib_retracement' || mode === 'fib_extension') {
          const levels = mode === 'fib_extension' ? FIB_EXT_LEVELS : FIB_LEVELS;
          const yDiff = cp.y - sp.y;
          levels.forEach((level, idx) => {
            const y = sp.y + yDiff * level;
            ctx.beginPath(); ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length]; ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 2]); ctx.moveTo(Math.min(sp.x, cp.x), y); ctx.lineTo(Math.max(sp.x, cp.x), y);
            ctx.stroke(); ctx.setLineDash([]);
          });
        }
        ctx.globalAlpha = 1;
      }
    }

    // Pen preview
    if (drawingModeRef.current === 'pen' && penCoords.current.length > 1) {
      ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
      penCoords.current.forEach((p, i) => {
        const px = toPixel(p.time, p.price);
        if (!px) return;
        if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    }

    // Laser
    if (laserPixels.current.length > 1) {
      const now = Date.now();
      laserPixels.current = laserPixels.current.filter(p => now - p.t < 1500);
      if (laserPixels.current.length > 1) {
        ctx.beginPath(); ctx.lineWidth = 2.5;
        laserPixels.current.forEach((p, i) => {
          ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1 - (now - p.t) / 1500)})`;
          if (i === 0) ctx.moveTo(p.x, p.y); else { ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        });
        laserRaf.current = requestAnimationFrame(render);
      }
    }
  }, [chart, series, drawings, toPixel, renderHLine, renderVLine, renderTrendline, renderFib, renderRectangle, renderPen, drawingModeRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    if (mode === 'none') return;
    const coord = fromPixel(e.clientX, e.clientY);
    if (!coord) return;

    if (mode === 'laser') {
      isDrawing.current = true;
      laserPixels.current = [{ x: coord.x, y: coord.y, t: Date.now() }];
      cancelAnimationFrame(laserRaf.current);
      laserRaf.current = requestAnimationFrame(render);
      return;
    }
    if (mode === 'pen') {
      isDrawing.current = true;
      penCoords.current = [{ time: coord.time, price: coord.price }];
      return;
    }
    if (mode === 'hline') {
      onAddDrawing({ id: `hline_${Date.now()}`, type: 'hline', price: coord.price, color: '#f59e0b' });
      onFinishDrawing(); render(); return;
    }
    if (mode === 'vline') {
      onAddDrawing({ id: `vline_${Date.now()}`, type: 'vline', points: [{ time: coord.time as number, price: coord.price }], color: '#06b6d4' });
      onFinishDrawing(); render(); return;
    }
    isDrawing.current = true;
    startCoord.current = { time: coord.time, price: coord.price };
    currentPixel.current = { x: coord.x, y: coord.y };
  }, [fromPixel, onAddDrawing, onFinishDrawing, render, drawingModeRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    if (mode === 'none' || !isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'laser') {
      laserPixels.current.push({ x, y, t: Date.now() });
      return;
    }
    if (mode === 'pen') {
      const coord = fromPixel(e.clientX, e.clientY);
      if (coord) penCoords.current.push({ time: coord.time, price: coord.price });
      render(); return;
    }
    currentPixel.current = { x, y };
    render();
  }, [fromPixel, render, drawingModeRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    if (mode === 'laser') {
      isDrawing.current = false;
      const fadeOut = () => {
        laserPixels.current = laserPixels.current.filter(p => Date.now() - p.t < 1500);
        render();
        if (laserPixels.current.length > 0) laserRaf.current = requestAnimationFrame(fadeOut);
      };
      laserRaf.current = requestAnimationFrame(fadeOut);
      return;
    }
    if (mode === 'pen' && isDrawing.current) {
      isDrawing.current = false;
      if (penCoords.current.length > 1) {
        onAddDrawing({
          id: `pen_${Date.now()}`, type: 'pen',
          points: penCoords.current.map(p => ({ time: p.time as number, price: p.price })),
          color: '#22c55e',
        });
      }
      penCoords.current = [];
      onFinishDrawing(); render(); return;
    }
    if (!isDrawing.current || !startCoord.current) return;
    isDrawing.current = false;
    const coord = fromPixel(e.clientX, e.clientY);
    if (!coord) { startCoord.current = null; return; }

    const colors: Record<string, string> = {
      trendline: '#22c55e', fib_retracement: '#f59e0b', fib_extension: '#8b5cf6', rectangle: '#3b82f6',
    };
    const type = mode as 'trendline' | 'fib_retracement' | 'fib_extension' | 'rectangle';
    onAddDrawing({
      id: `${type}_${Date.now()}`, type,
      points: [
        { time: startCoord.current.time as number, price: startCoord.current.price },
        { time: coord.time as number, price: coord.price },
      ],
      color: colors[type] || '#ffffff',
    });
    startCoord.current = null;
    currentPixel.current = null;
    onFinishDrawing(); render();
  }, [fromPixel, onAddDrawing, onFinishDrawing, render, drawingModeRef]);

  useEffect(() => {
    if (!chart) return;
    const handler = () => render();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler); };
  }, [chart, render]);

  useEffect(() => { render(); }, [drawings, render]);
  useEffect(() => () => { cancelAnimationFrame(laserRaf.current); }, []);

  const isActive = drawingMode !== 'none';

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${isActive ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: isActive ? 'none' : 'auto', zIndex: isActive ? 999 : 5 }}
    />
  );
}
