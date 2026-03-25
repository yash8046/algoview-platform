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
  onRemoveDrawing?: (id: string) => void;
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

  // === RENDERERS ===

  const renderHLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (d.price == null || !series) return;
    const y = series.priceToCoordinate(d.price);
    if (y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
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
    ctx.lineWidth = d.lineWidth || 1;
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
    ctx.lineWidth = d.lineWidth || 1.5;
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

  const renderRay = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const scale = Math.max(w, h) * 3 / len;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + dx * scale, p1.y + dy * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
  }, [toPixel]);

  const renderExtendedLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const scale = Math.max(w, h) * 3 / len;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x - dx * scale, p1.y - dy * scale);
    ctx.lineTo(p1.x + dx * scale, p1.y + dy * scale);
    ctx.stroke();
  }, [toPixel]);

  const renderArrowLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const headLen = 10;
    ctx.beginPath();
    ctx.fillStyle = d.color;
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - headLen * Math.cos(angle - 0.4), p2.y - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(p2.x - headLen * Math.cos(angle + 0.4), p2.y - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }, [toPixel]);

  const renderCrossLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = d.color;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(d.points[0].price.toFixed(2), x + 4, y - 4);
  }, [chart, series]);

  const renderHRay = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(x, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = d.color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(d.points[0].price.toFixed(2), x + 4, y - 4);
  }, [chart, series]);

  const renderInfoLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
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
    // Info label
    const priceDiff = d.points[1].price - d.points[0].price;
    const pctChange = ((priceDiff / d.points[0].price) * 100).toFixed(2);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(midX - 2, midY - 22, 100, 20);
    ctx.fillStyle = priceDiff >= 0 ? '#22c55e' : '#ef4444';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange}%)`, midX + 2, midY - 8);
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

  const renderFibFan = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const fanLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    fanLevels.forEach((level, idx) => {
      const targetY = p1.y + (p2.y - p1.y) * level;
      const dx = p2.x - p1.x;
      const dy = targetY - p1.y;
      const scale = dx !== 0 ? (w * 2) / Math.abs(dx) : 1;
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx + 1];
      ctx.lineWidth = 0.8;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x + dx * scale, p1.y + dy * scale);
      ctx.stroke();
      ctx.fillStyle = FIB_COLORS[idx + 1];
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${(level * 100).toFixed(1)}%`, p2.x + 4, p1.y + dy - 2);
    });
  }, [toPixel]);

  const renderFibArc = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const arcLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    arcLevels.forEach((level, idx) => {
      const r = dist * level;
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx + 1];
      ctx.lineWidth = 0.8;
      ctx.arc(p2.x, p2.y, r, 0, Math.PI, p2.y > p1.y);
      ctx.stroke();
    });
  }, [toPixel]);

  const renderFibTimeZones = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, h: number) => {
    if (!d.points || d.points.length < 2 || !chart) return;
    const x1 = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const x2 = chart.timeScale().timeToCoordinate(d.points[1].time as unknown as Time);
    if (x1 === null || x2 === null) return;
    const gap = Math.abs(x2 - x1);
    const fibNums = [1, 1, 2, 3, 5, 8, 13, 21];
    let x = Math.min(x1, x2);
    fibNums.forEach((n, idx) => {
      x += gap * n / fibNums[0];
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length];
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }, [chart]);

  const renderFibChannel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const channelHeight = Math.abs(p2.y - p1.y);
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    levels.forEach((level, idx) => {
      const offsetY = channelHeight * level * (p2.y > p1.y ? 1 : -1);
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length];
      ctx.lineWidth = level === 0 || level === 1 ? 1.5 : 0.8;
      ctx.moveTo(p1.x, p1.y + offsetY);
      ctx.lineTo(p2.x, p1.y + offsetY);
      ctx.stroke();
    });
  }, [toPixel]);

  const renderRectangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const rx = Math.min(p1.x, p2.x);
    const ry = Math.min(p1.y, p2.y);
    const rw = Math.abs(p2.x - p1.x);
    const rh = Math.abs(p2.y - p1.y);
    ctx.globalAlpha = d.opacity || 0.1;
    ctx.fillStyle = d.color;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }, [toPixel]);

  const renderCircle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    ctx.globalAlpha = d.opacity || 0.1;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }, [toPixel]);

  const renderEllipse = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const rx = Math.abs(p2.x - p1.x) / 2;
    const ry = Math.abs(p2.y - p1.y) / 2;
    ctx.globalAlpha = d.opacity || 0.1;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, [toPixel]);

  const renderTriangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const topX = (p1.x + p2.x) / 2;
    const topY = Math.min(p1.y, p2.y);
    const botY = Math.max(p1.y, p2.y);
    ctx.globalAlpha = d.opacity || 0.1;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(p1.x, botY);
    ctx.lineTo(p2.x, botY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(p1.x, botY);
    ctx.lineTo(p2.x, botY);
    ctx.closePath();
    ctx.stroke();
  }, [toPixel]);

  const renderParallelChannel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const channelWidth = Math.abs(p2.y - p1.y) * 0.5;
    const dy = p2.y - p1.y;
    const perpY = dy > 0 ? -channelWidth : channelWidth;
    // Top line
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    // Bottom line (parallel)
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y + perpY); ctx.lineTo(p2.x, p2.y + perpY);
    ctx.stroke();
    // Middle line (dashed)
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 0.8;
    ctx.moveTo(p1.x, p1.y + perpY / 2); ctx.lineTo(p2.x, p2.y + perpY / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Fill
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y + perpY); ctx.lineTo(p1.x, p1.y + perpY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [toPixel]);

  const renderPitchfork = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const midY = (p1.y + p2.y) / 2;
    const midX = (p1.x + p2.x) / 2;
    const halfH = Math.abs(p2.y - p1.y) / 2;
    const extX = w;
    // Median line
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(Math.min(p1.x, p2.x) - 20, midY);
    ctx.lineTo(extX, midY);
    ctx.stroke();
    // Upper
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(extX, Math.min(p1.y, p2.y));
    ctx.stroke();
    // Lower
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(extX, Math.max(p1.y, p2.y));
    ctx.stroke();
  }, [toPixel]);

  const renderPen = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1.5;
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
  }, [toPixel]);

  const renderBrush = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }, [toPixel]);

  const renderHighlighter = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 12;
    ctx.globalAlpha = 0.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }, [toPixel]);

  const renderText = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    ctx.fillStyle = d.color;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(d.text || 'Text', p.x, p.y);
  }, [toPixel]);

  const renderCallout = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    const text = d.text || 'Note';
    const w = ctx.measureText(text).width + 16;
    const h = 24;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y - h - 8, w, h, 4);
    ctx.fill();
    // Pointer
    ctx.beginPath();
    ctx.moveTo(p.x + 10, p.y - 8);
    ctx.lineTo(p.x + 16, p.y);
    ctx.lineTo(p.x + 22, p.y - 8);
    ctx.fill();
    ctx.fillStyle = d.color;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(text, p.x + 8, p.y - h + 8);
  }, [toPixel]);

  const renderArrowMarker = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    const isUp = d.type === 'arrow_marker_up';
    ctx.fillStyle = isUp ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    if (isUp) {
      ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(p.x - 6, p.y);
      ctx.lineTo(p.x + 6, p.y);
    } else {
      ctx.moveTo(p.x, p.y + 12);
      ctx.lineTo(p.x - 6, p.y);
      ctx.lineTo(p.x + 6, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }, [toPixel]);

  const renderFlag = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, h: number) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    // Pole
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 30);
    ctx.stroke();
    // Flag
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y - 30);
    ctx.lineTo(x + 16, y - 25);
    ctx.lineTo(x, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [chart, series]);

  const renderPriceLabel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points?.[0] || !series) return;
    const y = series.priceToCoordinate(d.points[0].price);
    if (y === null) return;
    const text = d.points[0].price.toFixed(2);
    const tw = ctx.measureText(text).width + 12;
    ctx.fillStyle = d.color;
    ctx.fillRect(w - tw - 4, y - 10, tw, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(text, w - tw, y + 4);
  }, [series]);

  const renderPriceRange = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const midX = (p1.x + p2.x) / 2;
    // Vertical bracket
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(midX, p1.y); ctx.lineTo(midX, p2.y);
    ctx.stroke();
    // Horizontal caps
    ctx.beginPath();
    ctx.moveTo(midX - 6, p1.y); ctx.lineTo(midX + 6, p1.y);
    ctx.moveTo(midX - 6, p2.y); ctx.lineTo(midX + 6, p2.y);
    ctx.stroke();
    // Label
    const diff = d.points[1].price - d.points[0].price;
    const pct = ((diff / d.points[0].price) * 100).toFixed(2);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(midX + 8, (p1.y + p2.y) / 2 - 18, 90, 32);
    ctx.fillStyle = diff >= 0 ? '#22c55e' : '#ef4444';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`, midX + 12, (p1.y + p2.y) / 2 - 4);
    ctx.fillText(`${pct}%`, midX + 12, (p1.y + p2.y) / 2 + 10);
  }, [toPixel]);

  const renderDateRange = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2 || !chart) return;
    const x1 = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const x2 = chart.timeScale().timeToCoordinate(d.points[1].time as unknown as Time);
    const y = series?.priceToCoordinate(d.points[0].price);
    if (x1 === null || x2 === null || y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y - 6); ctx.lineTo(x1, y + 6);
    ctx.moveTo(x2, y - 6); ctx.lineTo(x2, y + 6);
    ctx.stroke();
    const bars = Math.abs(d.points[1].time - d.points[0].time);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    const midX = (x1 + x2) / 2;
    ctx.fillRect(midX - 30, y - 22, 60, 16);
    ctx.fillStyle = d.color;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.round(bars / 60)}m`, midX - 24, y - 10);
  }, [chart, series]);

  const renderLongShort = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const isLong = d.type === 'long_position';
    const entry = d.points[0].price;
    const target = d.points[1].price;
    const color = isLong ? '#22c55e' : '#ef4444';
    const bgColor = isLong ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
    // Entry line
    ctx.beginPath();
    ctx.strokeStyle = '#6b7a99';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Target area
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color;
    ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    ctx.globalAlpha = 1;
    // Target line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p2.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    // Label
    const pnl = target - entry;
    const pct = ((pnl / entry) * 100).toFixed(2);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(p2.x + 4, p2.y - 10, 80, 20);
    ctx.fillStyle = color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${isLong ? 'Long' : 'Short'} ${pct}%`, p2.x + 8, p2.y + 4);
  }, [toPixel]);

  // === MAIN RENDER ===

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
      if (d.visible === false) continue;
      switch (d.type) {
        case 'hline': renderHLine(ctx, d, rect.width); break;
        case 'vline': renderVLine(ctx, d, rect.height); break;
        case 'trendline': renderTrendline(ctx, d); break;
        case 'ray': renderRay(ctx, d, rect.width, rect.height); break;
        case 'extended_line': renderExtendedLine(ctx, d, rect.width, rect.height); break;
        case 'arrow_line': renderArrowLine(ctx, d); break;
        case 'cross_line': renderCrossLine(ctx, d, rect.width, rect.height); break;
        case 'h_ray': renderHRay(ctx, d, rect.width); break;
        case 'info_line': renderInfoLine(ctx, d); break;
        case 'fib_retracement':
        case 'fib_extension': renderFib(ctx, d); break;
        case 'fib_fan': renderFibFan(ctx, d, rect.width); break;
        case 'fib_arc': renderFibArc(ctx, d); break;
        case 'fib_time_zones': renderFibTimeZones(ctx, d, rect.height); break;
        case 'fib_channel': renderFibChannel(ctx, d); break;
        case 'rectangle': renderRectangle(ctx, d); break;
        case 'circle': renderCircle(ctx, d); break;
        case 'ellipse': renderEllipse(ctx, d); break;
        case 'triangle': renderTriangle(ctx, d); break;
        case 'parallel_channel': renderParallelChannel(ctx, d); break;
        case 'disjoint_channel': renderParallelChannel(ctx, d); break; // same render
        case 'pitchfork': renderPitchfork(ctx, d, rect.width); break;
        case 'pen':
        case 'polyline': renderPen(ctx, d); break;
        case 'brush': renderBrush(ctx, d); break;
        case 'highlighter': renderHighlighter(ctx, d); break;
        case 'text': renderText(ctx, d); break;
        case 'callout': renderCallout(ctx, d); break;
        case 'arrow_marker_up':
        case 'arrow_marker_down': renderArrowMarker(ctx, d); break;
        case 'flag': renderFlag(ctx, d, rect.height); break;
        case 'price_label': renderPriceLabel(ctx, d, rect.width); break;
        case 'price_range': renderPriceRange(ctx, d); break;
        case 'date_range': renderDateRange(ctx, d); break;
        case 'long_position':
        case 'short_position': renderLongShort(ctx, d); break;
        case 'arc': renderFibArc(ctx, d); break; // reuse arc rendering
      }
    }

    // In-progress preview
    if (isDrawing.current && startCoord.current && currentPixel.current) {
      const sp = toPixel(startCoord.current.time, startCoord.current.price);
      if (sp) {
        const cp = currentPixel.current;
        const mode = drawingModeRef.current;
        ctx.globalAlpha = 0.6;
        if (mode === 'trendline' || mode === 'ray' || mode === 'extended_line' || mode === 'arrow_line' || mode === 'info_line') {
          ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
          ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        } else if (mode === 'rectangle' || mode === 'parallel_channel' || mode === 'disjoint_channel' || mode === 'pitchfork' || mode === 'fib_channel') {
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.strokeRect(Math.min(sp.x, cp.x), Math.min(sp.y, cp.y), Math.abs(cp.x - sp.x), Math.abs(cp.y - sp.y));
        } else if (mode === 'circle') {
          const r = Math.sqrt((cp.x - sp.x) ** 2 + (cp.y - sp.y) ** 2);
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (mode === 'ellipse') {
          const rx = Math.abs(cp.x - sp.x) / 2;
          const ry = Math.abs(cp.y - sp.y) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.ellipse((sp.x + cp.x) / 2, (sp.y + cp.y) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (mode === 'triangle') {
          const topX = (sp.x + cp.x) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.moveTo(topX, Math.min(sp.y, cp.y));
          ctx.lineTo(sp.x, Math.max(sp.y, cp.y));
          ctx.lineTo(cp.x, Math.max(sp.y, cp.y));
          ctx.closePath(); ctx.stroke();
        } else if (mode === 'fib_retracement' || mode === 'fib_extension') {
          const levels = mode === 'fib_extension' ? FIB_EXT_LEVELS : FIB_LEVELS;
          const yDiff = cp.y - sp.y;
          levels.forEach((level, idx) => {
            const y = sp.y + yDiff * level;
            ctx.beginPath(); ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length]; ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 2]); ctx.moveTo(Math.min(sp.x, cp.x), y); ctx.lineTo(Math.max(sp.x, cp.x), y);
            ctx.stroke(); ctx.setLineDash([]);
          });
        } else if (mode === 'price_range' || mode === 'long_position' || mode === 'short_position') {
          const midX = (sp.x + cp.x) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
          ctx.moveTo(midX, sp.y); ctx.lineTo(midX, cp.y); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(midX - 6, sp.y); ctx.lineTo(midX + 6, sp.y);
          ctx.moveTo(midX - 6, cp.y); ctx.lineTo(midX + 6, cp.y);
          ctx.stroke();
        } else if (mode === 'date_range') {
          ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
          ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, sp.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Pen/brush/highlighter/polyline preview
    const freeDrawModes: DrawingMode[] = ['pen', 'brush', 'highlighter', 'polyline'];
    if (freeDrawModes.includes(drawingModeRef.current) && penCoords.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = drawingModeRef.current === 'highlighter' ? '#eab308' : '#22c55e';
      ctx.lineWidth = drawingModeRef.current === 'brush' ? 3 : drawingModeRef.current === 'highlighter' ? 12 : 2;
      if (drawingModeRef.current === 'highlighter') ctx.globalAlpha = 0.25;
      penCoords.current.forEach((p, i) => {
        const px = toPixel(p.time, p.price);
        if (!px) return;
        if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
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
  }, [chart, series, drawings, toPixel, drawingModeRef,
    renderHLine, renderVLine, renderTrendline, renderRay, renderExtendedLine, renderArrowLine,
    renderCrossLine, renderHRay, renderInfoLine, renderFib, renderFibFan, renderFibArc,
    renderFibTimeZones, renderFibChannel, renderRectangle, renderCircle, renderEllipse,
    renderTriangle, renderParallelChannel, renderPitchfork, renderPen, renderBrush,
    renderHighlighter, renderText, renderCallout, renderArrowMarker, renderFlag,
    renderPriceLabel, renderPriceRange, renderDateRange, renderLongShort]);

  // === INPUT HANDLING ===

  // Single-click tools (place at point)
  const singleClickModes: DrawingMode[] = ['hline', 'vline', 'cross_line', 'h_ray', 'text', 'callout', 'arrow_marker_up', 'arrow_marker_down', 'flag', 'price_label'];
  // Free-draw tools
  const freeDrawModes: DrawingMode[] = ['pen', 'brush', 'highlighter', 'polyline'];
  // Two-point tools
  const twoPointModes: DrawingMode[] = [
    'trendline', 'ray', 'extended_line', 'arrow_line', 'info_line',
    'fib_retracement', 'fib_extension', 'fib_fan', 'fib_arc', 'fib_time_zones', 'fib_channel',
    'rectangle', 'circle', 'ellipse', 'triangle',
    'parallel_channel', 'disjoint_channel', 'pitchfork',
    'price_range', 'date_range', 'long_position', 'short_position',
    'arc',
  ];

  const defaultColors: Record<string, string> = {
    trendline: '#22c55e', ray: '#22c55e', extended_line: '#22c55e', arrow_line: '#22c55e',
    info_line: '#06b6d4', hline: '#f59e0b', vline: '#06b6d4', cross_line: '#6b7a99',
    h_ray: '#f59e0b',
    fib_retracement: '#f59e0b', fib_extension: '#8b5cf6', fib_fan: '#f59e0b',
    fib_arc: '#f59e0b', fib_time_zones: '#06b6d4', fib_channel: '#f59e0b',
    rectangle: '#3b82f6', circle: '#3b82f6', ellipse: '#3b82f6', triangle: '#3b82f6',
    parallel_channel: '#06b6d4', disjoint_channel: '#06b6d4', pitchfork: '#8b5cf6',
    pen: '#22c55e', brush: '#22c55e', highlighter: '#eab308', polyline: '#22c55e',
    text: '#ffffff', callout: '#f59e0b', arrow_marker_up: '#22c55e', arrow_marker_down: '#ef4444',
    flag: '#f59e0b', price_label: '#3b82f6',
    price_range: '#f59e0b', date_range: '#06b6d4',
    long_position: '#22c55e', short_position: '#ef4444',
    arc: '#3b82f6',
  };

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

    if (freeDrawModes.includes(mode)) {
      isDrawing.current = true;
      penCoords.current = [{ time: coord.time, price: coord.price }];
      return;
    }

    if (singleClickModes.includes(mode)) {
      const color = defaultColors[mode] || '#ffffff';
      if (mode === 'hline') {
        onAddDrawing({ id: `${mode}_${Date.now()}`, type: mode, price: coord.price, color });
      } else {
        const textPromptModes = ['text', 'callout'];
        let text: string | undefined;
        if (textPromptModes.includes(mode)) {
          text = prompt('Enter text:') || 'Note';
        }
        onAddDrawing({
          id: `${mode}_${Date.now()}`, type: mode,
          points: [{ time: coord.time as number, price: coord.price }],
          color, text,
        });
      }
      onFinishDrawing(); render();
      return;
    }

    if (twoPointModes.includes(mode)) {
      isDrawing.current = true;
      startCoord.current = { time: coord.time, price: coord.price };
      currentPixel.current = { x: coord.x, y: coord.y };
      return;
    }
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
      render();
      return;
    }
    if (freeDrawModes.includes(mode)) {
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
    if (freeDrawModes.includes(mode) && isDrawing.current) {
      isDrawing.current = false;
      if (penCoords.current.length > 1) {
        const color = defaultColors[mode] || '#22c55e';
        onAddDrawing({
          id: `${mode}_${Date.now()}`, type: mode,
          points: penCoords.current.map(p => ({ time: p.time as number, price: p.price })),
          color,
          lineWidth: mode === 'brush' ? 3 : mode === 'highlighter' ? 12 : 1.5,
        });
      }
      penCoords.current = [];
      onFinishDrawing(); render(); return;
    }
    if (!isDrawing.current || !startCoord.current) return;
    isDrawing.current = false;
    const coord = fromPixel(e.clientX, e.clientY);
    if (!coord) { startCoord.current = null; return; }

    const color = defaultColors[mode] || '#ffffff';
    onAddDrawing({
      id: `${mode}_${Date.now()}`, type: mode as any,
      points: [
        { time: startCoord.current.time as number, price: startCoord.current.price },
        { time: coord.time as number, price: coord.price },
      ],
      color,
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
      className={`w-full h-full ${isActive ? 'cursor-crosshair' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: isActive ? 'none' : 'auto' }}
    />
  );
}
