import { useEffect, useRef, useCallback, useState } from 'react';
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
  onUpdateDrawing?: (id: string, updates: Partial<DrawingLine>) => void;
  onCommitDragUndo?: (snapshot: DrawingLine[]) => void;
  magnetMode?: boolean;
  candleData?: { time: any; open: number; high: number; low: number; close: number }[];
}

export default function ChartOverlay({ chart, series, drawingMode, drawingModeRef, drawings, onAddDrawing, onFinishDrawing, onRemoveDrawing, onUpdateDrawing, onCommitDragUndo, magnetMode = false, candleData = [] }: ChartOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const startCoord = useRef<{ time: Time; price: number } | null>(null);
  const currentPixel = useRef<{ x: number; y: number } | null>(null);
  const penCoords = useRef<{ time: Time; price: number }[]>([]);
  const laserPixels = useRef<{ x: number; y: number; t: number }[]>([]);
  const laserRaf = useRef<number>(0);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const dragPointIndex = useRef<number | null>(null);
  const dragStartCoord = useRef<{ time: Time; price: number } | null>(null);
  const dragOriginalPoints = useRef<{ time: number; price: number }[] | null>(null);
  const dragOriginalPrice = useRef<number | null>(null);
  const dragSnapshotRef = useRef<DrawingLine[] | null>(null);
  const renderRafRef = useRef<number>(0);
  const renderScheduled = useRef(false);
  const crosshairPos = useRef<{ x: number; y: number } | null>(null);
  const lastMoveTime = useRef(0);

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

  // Magnet: snap to nearest OHLC
  const snapToOHLC = useCallback((time: any, price: number): { time: any; price: number } => {
    if (!magnetMode || candleData.length === 0 || !chart || !series) return { time, price };
    const targetX = chart.timeScale().timeToCoordinate(time as any);
    const targetY = series.priceToCoordinate(price);
    if (targetX === null || targetY === null) return { time, price };
    let nearest = candleData[0];
    let minPixelDist = Infinity;
    for (const c of candleData) {
      const cx = chart.timeScale().timeToCoordinate(c.time as any);
      if (cx === null) continue;
      const d = Math.abs(cx - targetX);
      if (d < minPixelDist) { minPixelDist = d; nearest = c; }
    }
    if (minPixelDist > 30) return { time, price };
    const ohlc = [
      { price: nearest.open }, { price: nearest.high },
      { price: nearest.low }, { price: nearest.close },
    ];
    let snapPrice = ohlc[0].price;
    let snapDist = Infinity;
    for (const o of ohlc) {
      const oy = series.priceToCoordinate(o.price);
      if (oy === null) continue;
      const d = Math.abs(targetY - oy);
      if (d < snapDist) { snapDist = d; snapPrice = o.price; }
    }
    return { time: nearest.time, price: snapPrice };
  }, [magnetMode, candleData, chart, series]);

  // === RENDERERS ===
  // (all render functions remain the same but wrapped in a single block for readability)

  const renderHLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (d.price == null || !series) return;
    const y = series.priceToCoordinate(d.price);
    if (y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = d.color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(d.price.toFixed(2), 4, y - 4);
  }, [series]);

  const renderVLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, h: number) => {
    if (!d.points?.[0] || !chart) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    if (x === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke(); ctx.setLineDash([]);
  }, [chart]);

  const renderTrendline = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, isSelected: boolean) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    // Anchor points
    const anchorSize = isSelected ? 5 : 3;
    [p1, p2].forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, anchorSize, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffffff' : d.color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = d.color; ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [toPixel]);

  const renderRay = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dx = p2.x - p1.x; const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const scale = Math.max(w, h) * 3 / len;
    ctx.beginPath();
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + dx * scale, p1.y + dy * scale);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
  }, [toPixel]);

  const renderExtendedLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dx = p2.x - p1.x; const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const scale = Math.max(w, h) * 3 / len;
    ctx.beginPath();
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
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
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const headLen = 10;
    ctx.beginPath(); ctx.fillStyle = d.color;
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - headLen * Math.cos(angle - 0.4), p2.y - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(p2.x - headLen * Math.cos(angle + 0.4), p2.y - headLen * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fill();
  }, [toPixel]);

  const renderCrossLine = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, h: number) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    ctx.beginPath();
    ctx.strokeStyle = d.color; ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 3]);
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
    ctx.stroke(); ctx.setLineDash([]);
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
    ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.setLineDash([6, 3]);
    ctx.moveTo(x, y); ctx.lineTo(w, y);
    ctx.stroke(); ctx.setLineDash([]);
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
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const priceDiff = d.points[1].price - d.points[0].price;
    const pctChange = ((priceDiff / d.points[0].price) * 100).toFixed(2);
    const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
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
    const minX = Math.min(fp1.x, fp2.x); const maxX = Math.max(fp1.x, fp2.x);
    levels.forEach((level, idx) => {
      const price = d.points![0].price + priceDiff * level;
      const y = series.priceToCoordinate(price);
      if (y === null) return;
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length]; ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 2]);
      ctx.moveTo(minX, y); ctx.lineTo(maxX, y);
      ctx.stroke(); ctx.setLineDash([]);
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
      const dx = p2.x - p1.x; const dy = targetY - p1.y;
      const scale = dx !== 0 ? (w * 2) / Math.abs(dx) : 1;
      ctx.beginPath();
      ctx.strokeStyle = FIB_COLORS[idx + 1]; ctx.lineWidth = 0.8;
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
      ctx.strokeStyle = FIB_COLORS[idx + 1]; ctx.lineWidth = 0.8;
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
      ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length]; ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke(); ctx.setLineDash([]);
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
      ctx.moveTo(p1.x, p1.y + offsetY); ctx.lineTo(p2.x, p1.y + offsetY);
      ctx.stroke();
    });
  }, [toPixel]);

  const renderRectangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const rx = Math.min(p1.x, p2.x); const ry = Math.min(p1.y, p2.y);
    const rw = Math.abs(p2.x - p1.x); const rh = Math.abs(p2.y - p1.y);
    ctx.globalAlpha = d.opacity || 0.1; ctx.fillStyle = d.color;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }, [toPixel]);

  const renderCircle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    ctx.globalAlpha = d.opacity || 0.1; ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2); ctx.stroke();
  }, [toPixel]);

  const renderEllipse = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2;
    const rx = Math.abs(p2.x - p1.x) / 2; const ry = Math.abs(p2.y - p1.y) / 2;
    ctx.globalAlpha = d.opacity || 0.1; ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  }, [toPixel]);

  const renderTriangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const topX = (p1.x + p2.x) / 2;
    const topY = Math.min(p1.y, p2.y); const botY = Math.max(p1.y, p2.y);
    ctx.globalAlpha = d.opacity || 0.1; ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(p1.x, botY); ctx.lineTo(p2.x, botY);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(p1.x, botY); ctx.lineTo(p2.x, botY);
    ctx.closePath(); ctx.stroke();
  }, [toPixel]);

  const renderParallelChannel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const channelWidth = Math.abs(p2.y - p1.y) * 0.5;
    const dy = p2.y - p1.y;
    const perpY = dy > 0 ? -channelWidth : channelWidth;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y + perpY); ctx.lineTo(p2.x, p2.y + perpY); ctx.stroke();
    ctx.beginPath(); ctx.setLineDash([4, 3]); ctx.lineWidth = 0.8;
    ctx.moveTo(p1.x, p1.y + perpY / 2); ctx.lineTo(p2.x, p2.y + perpY / 2);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.05; ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y + perpY); ctx.lineTo(p1.x, p1.y + perpY);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }, [toPixel]);

  const renderPitchfork = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const midY = (p1.y + p2.y) / 2;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(Math.min(p1.x, p2.x) - 20, midY); ctx.lineTo(w, midY); ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = 1;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(w, Math.min(p1.y, p2.y)); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y); ctx.lineTo(w, Math.max(p1.y, p2.y)); ctx.stroke();
  }, [toPixel]);

  const renderPen = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
  }, [toPixel]);

  const renderBrush = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }, [toPixel]);

  const renderHighlighter = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath(); ctx.strokeStyle = d.color;
    ctx.lineWidth = d.lineWidth || 12; ctx.globalAlpha = 0.25;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    d.points.forEach((p, i) => {
      const px = toPixel(p.time as unknown as Time, p.price);
      if (!px) return;
      if (i === 0) ctx.moveTo(px.x, px.y); else ctx.lineTo(px.x, px.y);
    });
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
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
    const w = ctx.measureText(text).width + 16; const h = 24;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.roundRect(p.x, p.y - h - 8, w, h, 4); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x + 10, p.y - 8); ctx.lineTo(p.x + 16, p.y); ctx.lineTo(p.x + 22, p.y - 8); ctx.fill();
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
      ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
    } else {
      ctx.moveTo(p.x, p.y + 12); ctx.lineTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
    }
    ctx.closePath(); ctx.fill();
  }, [toPixel]);

  const renderFlag = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y - 30); ctx.lineTo(x + 16, y - 25); ctx.lineTo(x, y - 20);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
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
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(midX, p1.y); ctx.lineTo(midX, p2.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX - 6, p1.y); ctx.lineTo(midX + 6, p1.y);
    ctx.moveTo(midX - 6, p2.y); ctx.lineTo(midX + 6, p2.y); ctx.stroke();
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
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y - 6); ctx.lineTo(x1, y + 6);
    ctx.moveTo(x2, y - 6); ctx.lineTo(x2, y + 6); ctx.stroke();
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
    const entry = d.points[0].price; const target = d.points[1].price;
    const color = isLong ? '#22c55e' : '#ef4444';
    ctx.beginPath(); ctx.strokeStyle = '#6b7a99'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p1.y);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.15; ctx.fillStyle = color;
    ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p2.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const pnl = target - entry; const pct = ((pnl / entry) * 100).toFixed(2);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(p2.x + 4, p2.y - 10, 80, 20);
    ctx.fillStyle = color;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${isLong ? 'Long' : 'Short'} ${pct}%`, p2.x + 8, p2.y + 4);
  }, [toPixel]);

  const renderVRay = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, h: number) => {
    if (!d.points?.[0] || !chart || !series) return;
    const x = chart.timeScale().timeToCoordinate(d.points[0].time as unknown as Time);
    const y = series.priceToCoordinate(d.points[0].price);
    if (x === null || y === null) return;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.setLineDash([6, 3]); ctx.moveTo(x, y); ctx.lineTo(x, h);
    ctx.stroke(); ctx.setLineDash([]);
  }, [chart, series]);

  const renderHSegment = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const y = p1.y;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, y); ctx.lineTo(p2.x, y); ctx.stroke();
    [p1.x, p2.x].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
    });
    ctx.fillStyle = d.color; ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(d.points[0].price.toFixed(2), p1.x + 4, y - 6);
  }, [toPixel]);

  const renderTrendAngle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const angle = Math.atan2(-(p2.y - p1.y), p2.x - p1.x);
    const angleDeg = (angle * 180 / Math.PI).toFixed(1);
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1;
    ctx.arc(p1.x, p1.y, 20, 0, -angle, angle > 0); ctx.stroke();
    ctx.beginPath(); ctx.setLineDash([3, 3]);
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x + 30, p1.y);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = d.color; ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${angleDeg}°`, p1.x + 24, p1.y - 8);
  }, [toPixel]);

  const renderArrowMarkerStandalone = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - 8, p.y + 14); ctx.lineTo(p.x - 3, p.y + 10);
    ctx.lineTo(p.x - 3, p.y + 22); ctx.lineTo(p.x + 3, p.y + 22);
    ctx.lineTo(p.x + 3, p.y + 10); ctx.lineTo(p.x + 8, p.y + 14);
    ctx.closePath(); ctx.fill();
  }, [toPixel]);

  const renderRegressionChannel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const dy = p2.y - p1.y; const dx = p2.x - p1.x;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    const dist = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / dist * 30; const perpY = dx / dist * 30;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.moveTo(p1.x + perpX, p1.y + perpY); ctx.lineTo(p2.x + perpX, p2.y + perpY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.x - perpX, p1.y - perpY); ctx.lineTo(p2.x - perpX, p2.y - perpY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.05; ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(p1.x + perpX, p1.y + perpY); ctx.lineTo(p2.x + perpX, p2.y + perpY);
    ctx.lineTo(p2.x - perpX, p2.y - perpY); ctx.lineTo(p1.x - perpX, p1.y - perpY);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }, [toPixel]);

  const renderFlatChannel = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(minX, p1.y); ctx.lineTo(maxX, p1.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(minX, p2.y); ctx.lineTo(maxX, p2.y); ctx.stroke();
    ctx.globalAlpha = 0.05; ctx.fillStyle = d.color;
    ctx.fillRect(minX, Math.min(p1.y, p2.y), maxX - minX, Math.abs(p2.y - p1.y));
    ctx.globalAlpha = 1;
    ctx.fillStyle = d.color; ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(d.points[0].price.toFixed(2), minX + 4, p1.y - 3);
    ctx.fillText(d.points[1].price.toFixed(2), minX + 4, p2.y - 3);
  }, [toPixel]);

  const renderSchiffPitchfork = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const startX = (p1.x + p2.x) / 2; const startY = (p1.y + p2.y) / 2;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.moveTo(startX, startY); ctx.lineTo(w, startY); ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = 1;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(w, Math.min(p1.y, p2.y)); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y); ctx.lineTo(w, Math.max(p1.y, p2.y)); ctx.stroke();
  }, [toPixel]);

  const renderFibSpeedResistance = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    levels.forEach((level, idx) => {
      const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) * level;
      ctx.beginPath(); ctx.strokeStyle = FIB_COLORS[idx + 1]; ctx.lineWidth = 0.8;
      ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2); ctx.stroke();
      const targetY = p1.y + (p2.y - p1.y) * level;
      ctx.beginPath(); ctx.setLineDash([3, 3]);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, targetY);
      ctx.stroke(); ctx.setLineDash([]);
    });
  }, [toPixel]);

  const renderFibSpiral = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const baseR = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const phi = 1.618;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1;
    for (let t = 0; t < Math.PI * 6; t += 0.05) {
      const r = baseR * Math.pow(phi, t / (2 * Math.PI)) * 0.1;
      const x = p1.x + r * Math.cos(t); const y = p1.y + r * Math.sin(t);
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [toPixel]);

  const renderFibWedge = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    const dy = p2.y - p1.y;
    levels.forEach((level, idx) => {
      const endY1 = p1.y + dy * level; const endY2 = p1.y - dy * level;
      ctx.beginPath(); ctx.strokeStyle = FIB_COLORS[idx + 1]; ctx.lineWidth = 0.8;
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, endY1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, endY2); ctx.stroke();
    });
  }, [toPixel]);

  const renderRotatedRectangle = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2;
    const w = Math.abs(p2.x - p1.x); const h = Math.abs(p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.globalAlpha = d.opacity || 0.1; ctx.fillStyle = d.color;
    ctx.fillRect(-w / 2, -h / 4, w, h / 2);
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1;
    ctx.strokeRect(-w / 2, -h / 4, w, h / 2);
    ctx.restore();
  }, [toPixel]);

  const renderBezierCurve = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const cpX = (p1.x + p2.x) / 2;
    const cpY = Math.min(p1.y, p2.y) - Math.abs(p2.y - p1.y) * 0.5;
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = d.lineWidth || 1.5;
    ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(cpX, cpY, p2.x, p2.y); ctx.stroke();
    ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.strokeStyle = d.color; ctx.lineWidth = 0.5;
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(cpX, cpY); ctx.lineTo(p2.x, p2.y);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cpX, cpY, 3, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
  }, [toPixel]);

  const renderAnchoredText = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    const text = d.text || 'Anchored';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = ctx.measureText(text).width + 8;
    ctx.fillRect(p.x - 2, p.y - 14, tw, 18);
    ctx.fillStyle = d.color; ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(text, p.x + 2, p.y);
    ctx.beginPath(); ctx.arc(p.x, p.y + 6, 2, 0, Math.PI * 2); ctx.fill();
  }, [toPixel]);

  const renderNoteBox = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points?.[0]) return;
    const p = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    if (!p) return;
    const text = d.text || 'Note';
    const lines = text.split('\n');
    const lineHeight = 14;
    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16;
    const boxH = lines.length * lineHeight + 12;
    ctx.fillStyle = 'rgba(30, 30, 50, 0.9)';
    ctx.beginPath(); ctx.roundRect(p.x, p.y - boxH, maxWidth, boxH, 4); ctx.fill();
    ctx.strokeStyle = d.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(p.x, p.y - boxH, maxWidth, boxH, 4); ctx.stroke();
    ctx.fillStyle = d.color; ctx.font = '10px "JetBrains Mono", monospace';
    lines.forEach((line, i) => {
      ctx.fillText(line, p.x + 8, p.y - boxH + 14 + i * lineHeight);
    });
  }, [toPixel]);

  const renderBarsPattern = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    ctx.globalAlpha = 0.08; ctx.fillStyle = d.color;
    ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    ctx.globalAlpha = 1; ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    ctx.setLineDash([]);
    const priceDiff = d.points[1].price - d.points[0].price;
    const pct = ((priceDiff / d.points[0].price) * 100).toFixed(2);
    const timeDiff = Math.abs(d.points[1].time - d.points[0].time);
    const hours = Math.floor(timeDiff / 3600); const mins = Math.floor((timeDiff % 3600) / 60);
    const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(cx - 50, cy - 24, 100, 44);
    ctx.fillStyle = priceDiff >= 0 ? '#22c55e' : '#ef4444';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${priceDiff >= 0 ? '+' : ''}${pct}%`, cx - 44, cy - 10);
    ctx.fillStyle = '#6b7a99';
    ctx.fillText(`${hours}h ${mins}m`, cx - 44, cy + 4);
    ctx.fillText(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)}`, cx - 44, cy + 16);
  }, [toPixel]);

  const renderRiskReward = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2 || !series) return;
    const entry = d.points[0].price; const target = d.points[1].price;
    const stopLoss = entry - (target - entry);
    const entryY = series.priceToCoordinate(entry);
    const targetY = series.priceToCoordinate(target);
    const slY = series.priceToCoordinate(stopLoss);
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2 || entryY === null || targetY === null || slY === null) return;
    const left = Math.min(p1.x, p2.x); const right = Math.max(p1.x, p2.x); const width = right - left;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(left, Math.min(entryY, targetY), width, Math.abs(targetY - entryY));
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(left, Math.min(entryY, slY), width, Math.abs(slY - entryY));
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.strokeStyle = '#6b7a99'; ctx.lineWidth = 1.5;
    ctx.moveTo(left, entryY); ctx.lineTo(right, entryY); ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
    ctx.moveTo(left, targetY); ctx.lineTo(right, targetY); ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.moveTo(left, slY); ctx.lineTo(right, slY); ctx.stroke(); ctx.setLineDash([]);
    const reward = Math.abs(target - entry); const risk = Math.abs(entry - stopLoss);
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '∞';
    const rewardPct = ((reward / entry) * 100).toFixed(2);
    const riskPct = ((risk / entry) * 100).toFixed(2);
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(right + 4, entryY - 40, 100, 76);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6b7a99'; ctx.fillText(`Entry: ${entry.toFixed(2)}`, right + 8, entryY - 26);
    ctx.fillStyle = '#22c55e'; ctx.fillText(`TP: +${rewardPct}%`, right + 8, entryY - 12);
    ctx.fillStyle = '#ef4444'; ctx.fillText(`SL: -${riskPct}%`, right + 8, entryY + 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`R:R = 1:${rr}`, right + 8, entryY + 18);
    ctx.fillText(`Target: ${target.toFixed(2)}`, right + 8, entryY + 32);
  }, [toPixel, series]);

  // === GANN RENDERERS ===

  const renderGannFan = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine, w: number, _h: number) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const angles = [
      { ratio: '1x1', slope: 1 }, { ratio: '1x2', slope: 0.5 }, { ratio: '2x1', slope: 2 },
      { ratio: '1x3', slope: 1/3 }, { ratio: '3x1', slope: 3 },
      { ratio: '1x4', slope: 0.25 }, { ratio: '4x1', slope: 4 },
      { ratio: '1x8', slope: 0.125 }, { ratio: '8x1', slope: 8 },
    ];
    const colors = ['#f59e0b', '#22c55e', '#22c55e', '#3b82f6', '#3b82f6', '#6b7a99', '#6b7a99', '#6b7a99', '#6b7a99'];
    const baseSlope = (p2.y - p1.y) / (p2.x - p1.x || 1);
    angles.forEach((a, idx) => {
      const dy = baseSlope * a.slope;
      const endX = w * 2; const endY = p1.y + dy * (endX - p1.x);
      ctx.beginPath(); ctx.strokeStyle = colors[idx];
      ctx.lineWidth = a.ratio === '1x1' ? 1.5 : 0.8;
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(endX, endY); ctx.stroke();
      if (idx < 5) {
        ctx.fillStyle = colors[idx]; ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(a.ratio, Math.min(p1.x + 60 + idx * 30, w - 30), p1.y + dy * (60 + idx * 30) - 3);
      }
    });
  }, [toPixel]);

  const renderGannBox = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const left = Math.min(p1.x, p2.x); const right = Math.max(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y); const bottom = Math.max(p1.y, p2.y);
    const w = right - left; const h = bottom - top;
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5; ctx.strokeRect(left, top, w, h);
    const divisions = [0.25, 0.382, 0.5, 0.618, 0.75];
    ctx.lineWidth = 0.6; ctx.setLineDash([3, 3]);
    divisions.forEach(div => {
      const x = left + w * div; const y = top + h * div;
      ctx.beginPath(); ctx.strokeStyle = '#6b7a99';
      ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 0.8;
    ctx.moveTo(left, top); ctx.lineTo(right, bottom); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right, top); ctx.lineTo(left, bottom); ctx.stroke();
    ctx.globalAlpha = 0.03; ctx.fillStyle = d.color;
    ctx.fillRect(left, top, w, h); ctx.globalAlpha = 1;
  }, [toPixel]);

  const renderGannSquare = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points || d.points.length < 2) return;
    const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
    const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
    if (!p1 || !p2) return;
    const size = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    const cx = p1.x; const cy = p1.y;
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - size/2, cy - size/2, size, size);
    ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 0.8;
    ctx.arc(cx, cy, size/2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = 0.6; ctx.setLineDash([3,3]);
    ctx.moveTo(cx - size/2, cy - size/2); ctx.lineTo(cx + size/2, cy + size/2);
    ctx.moveTo(cx + size/2, cy - size/2); ctx.lineTo(cx - size/2, cy + size/2);
    ctx.moveTo(cx, cy - size/2); ctx.lineTo(cx, cy + size/2);
    ctx.moveTo(cx - size/2, cy); ctx.lineTo(cx + size/2, cy);
    ctx.stroke(); ctx.setLineDash([]);
    [0.25, 0.5, 0.75].forEach(f => {
      ctx.beginPath(); ctx.strokeStyle = '#6b7a99'; ctx.lineWidth = 0.4;
      ctx.arc(cx, cy, size/2 * f, 0, Math.PI * 2); ctx.stroke();
    });
  }, [toPixel]);

  // === DRAW ANCHOR POINTS for selected drawing ===
  const drawAnchors = useCallback((ctx: CanvasRenderingContext2D, d: DrawingLine) => {
    if (!d.points) return;
    for (const pt of d.points) {
      const p = toPixel(pt.time as unknown as Time, pt.price);
      if (!p) continue;
      // Outer ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Inner fill
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
    // For hline, show a price anchor
    if (d.price != null && series) {
      const y = series.priceToCoordinate(d.price);
      if (y !== null) {
        [30, 60].forEach(xPos => {
          ctx.beginPath();
          ctx.arc(xPos, y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(xPos, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = d.color;
          ctx.fill();
        });
      }
    }
  }, [toPixel, series]);

  // === MAIN RENDER (RAF-throttled) ===

  const renderImmediate = useCallback(() => {
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
      const isSel = d.id === selectedDrawingId;
      try {
        switch (d.type) {
          case 'hline': renderHLine(ctx, d, rect.width); break;
          case 'vline': renderVLine(ctx, d, rect.height); break;
          case 'trendline': renderTrendline(ctx, d, isSel); break;
          case 'ray': renderRay(ctx, d, rect.width, rect.height); break;
          case 'extended_line': renderExtendedLine(ctx, d, rect.width, rect.height); break;
          case 'arrow_line': renderArrowLine(ctx, d); break;
          case 'cross_line': renderCrossLine(ctx, d, rect.width, rect.height); break;
          case 'h_ray': renderHRay(ctx, d, rect.width); break;
          case 'v_ray': renderVRay(ctx, d, rect.height); break;
          case 'h_segment': renderHSegment(ctx, d); break;
          case 'info_line': renderInfoLine(ctx, d); break;
          case 'trend_angle': renderTrendAngle(ctx, d); break;
          case 'arrow_marker_standalone': renderArrowMarkerStandalone(ctx, d); break;
          case 'fib_retracement': case 'fib_extension': case 'fib_trend_based': renderFib(ctx, d); break;
          case 'fib_fan': renderFibFan(ctx, d, rect.width); break;
          case 'fib_arc': renderFibArc(ctx, d); break;
          case 'fib_speed_resistance': renderFibSpeedResistance(ctx, d); break;
          case 'fib_spiral': renderFibSpiral(ctx, d); break;
          case 'fib_time_zones': renderFibTimeZones(ctx, d, rect.height); break;
          case 'fib_channel': renderFibChannel(ctx, d); break;
          case 'fib_wedge': renderFibWedge(ctx, d); break;
          case 'rectangle': renderRectangle(ctx, d); break;
          case 'rotated_rectangle': renderRotatedRectangle(ctx, d); break;
          case 'circle': renderCircle(ctx, d); break;
          case 'ellipse': renderEllipse(ctx, d); break;
          case 'triangle': renderTriangle(ctx, d); break;
          case 'bezier_curve': renderBezierCurve(ctx, d); break;
          case 'parallel_channel': renderParallelChannel(ctx, d); break;
          case 'disjoint_channel': case 'inside_pitchfork': renderParallelChannel(ctx, d); break;
          case 'regression_channel': renderRegressionChannel(ctx, d); break;
          case 'flat_channel': renderFlatChannel(ctx, d); break;
          case 'pitchfork': renderPitchfork(ctx, d, rect.width); break;
          case 'schiff_pitchfork': renderSchiffPitchfork(ctx, d, rect.width); break;
          case 'pen': case 'polyline': case 'path_tool': renderPen(ctx, d); break;
          case 'brush': renderBrush(ctx, d); break;
          case 'highlighter': renderHighlighter(ctx, d); break;
          case 'text': renderText(ctx, d); break;
          case 'anchored_text': renderAnchoredText(ctx, d); break;
          case 'note_box': renderNoteBox(ctx, d); break;
          case 'callout': renderCallout(ctx, d); break;
          case 'arrow_marker_up': case 'arrow_marker_down': renderArrowMarker(ctx, d); break;
          case 'flag': renderFlag(ctx, d); break;
          case 'price_label': renderPriceLabel(ctx, d, rect.width); break;
          case 'price_range': renderPriceRange(ctx, d); break;
          case 'date_range': renderDateRange(ctx, d); break;
          case 'bars_pattern': renderBarsPattern(ctx, d); break;
          case 'risk_reward': renderRiskReward(ctx, d); break;
          case 'long_position': case 'short_position': renderLongShort(ctx, d); break;
          case 'gann_fan': renderGannFan(ctx, d, rect.width, rect.height); break;
          case 'gann_box': renderGannBox(ctx, d); break;
          case 'gann_square': renderGannSquare(ctx, d); break;
        }
      } catch {}
      // Draw anchor points for selected drawing
      if (isSel) {
        drawAnchors(ctx, d);
      }
    }

    // Selection highlight for hline
    if (selectedDrawingId) {
      const selD = drawings.find(d => d.id === selectedDrawingId);
      if (selD && selD.price != null && series) {
        const y = series.priceToCoordinate(selD.price);
        if (y !== null) {
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.moveTo(0, y); ctx.lineTo(rect.width, y);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    // Drawing preview (in-progress)
    if (isDrawing.current && startCoord.current && currentPixel.current) {
      const sp = toPixel(startCoord.current.time, startCoord.current.price);
      if (sp) {
        const cp = currentPixel.current;
        const mode = drawingModeRef.current;
        ctx.globalAlpha = 0.6;
        const lineModes: DrawingMode[] = ['trendline', 'ray', 'extended_line', 'arrow_line', 'info_line', 'trend_angle', 'h_segment', 'gann_fan'];
        const rectModes: DrawingMode[] = ['rectangle', 'rotated_rectangle', 'parallel_channel', 'disjoint_channel', 'pitchfork', 'fib_channel', 'regression_channel', 'flat_channel', 'schiff_pitchfork', 'inside_pitchfork', 'bars_pattern', 'gann_box', 'gann_square'];
        const fibModes: DrawingMode[] = ['fib_retracement', 'fib_extension', 'fib_trend_based', 'fib_fan', 'fib_speed_resistance', 'fib_wedge'];

        if (lineModes.includes(mode)) {
          ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
          ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        } else if (rectModes.includes(mode)) {
          ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.strokeRect(Math.min(sp.x, cp.x), Math.min(sp.y, cp.y), Math.abs(cp.x - sp.x), Math.abs(cp.y - sp.y));
        } else if (mode === 'circle') {
          const r = Math.sqrt((cp.x - sp.x) ** 2 + (cp.y - sp.y) ** 2);
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (mode === 'ellipse') {
          const rx = Math.abs(cp.x - sp.x) / 2; const ry = Math.abs(cp.y - sp.y) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.ellipse((sp.x + cp.x) / 2, (sp.y + cp.y) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (mode === 'triangle') {
          const topX = (sp.x + cp.x) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
          ctx.moveTo(topX, Math.min(sp.y, cp.y));
          ctx.lineTo(sp.x, Math.max(sp.y, cp.y));
          ctx.lineTo(cp.x, Math.max(sp.y, cp.y));
          ctx.closePath(); ctx.stroke();
        } else if (mode === 'bezier_curve') {
          const cpX = (sp.x + cp.x) / 2;
          const cpY = Math.min(sp.y, cp.y) - Math.abs(cp.y - sp.y) * 0.5;
          ctx.beginPath(); ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1.5;
          ctx.moveTo(sp.x, sp.y); ctx.quadraticCurveTo(cpX, cpY, cp.x, cp.y); ctx.stroke();
        } else if (fibModes.includes(mode)) {
          const levels = mode === 'fib_extension' ? FIB_EXT_LEVELS : FIB_LEVELS;
          const yDiff = cp.y - sp.y;
          levels.forEach((level, idx) => {
            const y = sp.y + yDiff * level;
            ctx.beginPath(); ctx.strokeStyle = FIB_COLORS[idx % FIB_COLORS.length]; ctx.lineWidth = 0.8;
            ctx.setLineDash([4, 2]); ctx.moveTo(Math.min(sp.x, cp.x), y); ctx.lineTo(Math.max(sp.x, cp.x), y);
            ctx.stroke(); ctx.setLineDash([]);
          });
        } else if (mode === 'fib_arc' || mode === 'fib_spiral' || mode === 'arc') {
          const r = Math.sqrt((cp.x - sp.x) ** 2 + (cp.y - sp.y) ** 2);
          ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
          ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (mode === 'price_range' || mode === 'long_position' || mode === 'short_position' || mode === 'risk_reward') {
          const midX = (sp.x + cp.x) / 2;
          ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
          ctx.moveTo(midX, sp.y); ctx.lineTo(midX, cp.y); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(midX - 6, sp.y); ctx.lineTo(midX + 6, sp.y);
          ctx.moveTo(midX - 6, cp.y); ctx.lineTo(midX + 6, cp.y); ctx.stroke();
        } else if (mode === 'date_range') {
          ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
          ctx.moveTo(sp.x, sp.y); ctx.lineTo(cp.x, sp.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Pen/brush/highlighter/polyline/path preview
    const freeDrawModes: DrawingMode[] = ['pen', 'brush', 'highlighter', 'polyline', 'path_tool'];
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
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Laser
    if (laserPixels.current.length > 1) {
      const now = Date.now();
      laserPixels.current = laserPixels.current.filter(p => now - p.t < 1500);
      if (laserPixels.current.length > 1) {
        ctx.beginPath(); ctx.lineWidth = 2.5;
        laserPixels.current.forEach((p, i) => {
          ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1 - (now - p.t) / 1500)})`;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else { ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        });
        laserRaf.current = requestAnimationFrame(() => scheduleRender());
      }
    }
  }, [chart, series, drawings, toPixel, drawingModeRef, selectedDrawingId, drawAnchors,
    renderHLine, renderVLine, renderTrendline, renderRay, renderExtendedLine, renderArrowLine,
    renderCrossLine, renderHRay, renderVRay, renderHSegment, renderInfoLine, renderTrendAngle,
    renderArrowMarkerStandalone, renderFib, renderFibFan, renderFibArc, renderFibSpeedResistance,
    renderFibSpiral, renderFibTimeZones, renderFibChannel, renderFibWedge,
    renderRectangle, renderRotatedRectangle, renderCircle, renderEllipse, renderTriangle,
    renderBezierCurve, renderParallelChannel, renderRegressionChannel, renderFlatChannel,
    renderPitchfork, renderSchiffPitchfork, renderPen, renderBrush, renderHighlighter,
    renderText, renderAnchoredText, renderNoteBox, renderCallout, renderArrowMarker,
    renderFlag, renderPriceLabel, renderPriceRange, renderDateRange, renderBarsPattern,
    renderRiskReward, renderLongShort, renderGannFan, renderGannBox, renderGannSquare]);

  // RAF-throttled render scheduler
  const scheduleRender = useCallback(() => {
    if (renderScheduled.current) return;
    renderScheduled.current = true;
    renderRafRef.current = requestAnimationFrame(() => {
      renderScheduled.current = false;
      renderImmediate();
    });
  }, [renderImmediate]);

  // === INPUT HANDLING ===

  const singleClickModes: DrawingMode[] = [
    'hline', 'vline', 'cross_line', 'h_ray', 'v_ray',
    'text', 'anchored_text', 'note_box', 'callout',
    'arrow_marker_up', 'arrow_marker_down', 'arrow_marker_standalone',
    'flag', 'price_label',
  ];
  const freeDrawModesInput: DrawingMode[] = ['pen', 'brush', 'highlighter', 'polyline', 'path_tool'];
  const twoPointModes: DrawingMode[] = [
    'trendline', 'ray', 'extended_line', 'arrow_line', 'info_line', 'trend_angle', 'h_segment',
    'fib_retracement', 'fib_extension', 'fib_trend_based', 'fib_fan', 'fib_arc',
    'fib_speed_resistance', 'fib_spiral', 'fib_time_zones', 'fib_channel', 'fib_wedge',
    'rectangle', 'rotated_rectangle', 'circle', 'ellipse', 'triangle', 'bezier_curve',
    'parallel_channel', 'disjoint_channel', 'regression_channel', 'flat_channel',
    'pitchfork', 'schiff_pitchfork', 'inside_pitchfork',
    'price_range', 'date_range', 'bars_pattern', 'risk_reward',
    'long_position', 'short_position', 'arc',
    'gann_fan', 'gann_box', 'gann_square',
  ];

  const defaultColors: Record<string, string> = {
    trendline: '#22c55e', ray: '#22c55e', extended_line: '#22c55e', arrow_line: '#22c55e',
    info_line: '#06b6d4', trend_angle: '#f59e0b', h_segment: '#f59e0b',
    hline: '#f59e0b', vline: '#06b6d4', cross_line: '#6b7a99',
    h_ray: '#f59e0b', v_ray: '#06b6d4', arrow_marker_standalone: '#f59e0b',
    fib_retracement: '#f59e0b', fib_extension: '#8b5cf6', fib_trend_based: '#f59e0b',
    fib_fan: '#f59e0b', fib_arc: '#f59e0b', fib_speed_resistance: '#8b5cf6',
    fib_spiral: '#f59e0b', fib_time_zones: '#06b6d4', fib_channel: '#f59e0b', fib_wedge: '#f59e0b',
    rectangle: '#3b82f6', rotated_rectangle: '#3b82f6', circle: '#3b82f6', ellipse: '#3b82f6',
    triangle: '#3b82f6', bezier_curve: '#8b5cf6', path_tool: '#22c55e',
    parallel_channel: '#06b6d4', disjoint_channel: '#06b6d4',
    regression_channel: '#8b5cf6', flat_channel: '#06b6d4',
    pitchfork: '#8b5cf6', schiff_pitchfork: '#8b5cf6', inside_pitchfork: '#8b5cf6',
    pen: '#22c55e', brush: '#22c55e', highlighter: '#eab308', polyline: '#22c55e',
    text: '#ffffff', anchored_text: '#f59e0b', note_box: '#eab308',
    callout: '#f59e0b', arrow_marker_up: '#22c55e', arrow_marker_down: '#ef4444',
    flag: '#f59e0b', price_label: '#3b82f6',
    price_range: '#f59e0b', date_range: '#06b6d4', bars_pattern: '#06b6d4',
    risk_reward: '#f59e0b',
    long_position: '#22c55e', short_position: '#ef4444',
    arc: '#3b82f6',
    gann_fan: '#f59e0b', gann_box: '#f59e0b', gann_square: '#f59e0b',
  };

  // Find nearest drawing for eraser/selection
  const findNearestDrawing = useCallback((px: number, py: number): string | null => {
    const threshold = 18;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (d.visible === false) continue;
      if (d.price != null && series) {
        const y = series.priceToCoordinate(d.price);
        if (y !== null && Math.abs(py - y) < threshold) return d.id;
      }
      if (d.points) {
        for (const pt of d.points) {
          const p = toPixel(pt.time as unknown as Time, pt.price);
          if (p && Math.abs(px - p.x) < threshold && Math.abs(py - p.y) < threshold) return d.id;
        }
        // Also check line segments between points for better hit detection
        if (d.points.length >= 2) {
          const p1 = toPixel(d.points[0].time as unknown as Time, d.points[0].price);
          const p2 = toPixel(d.points[1].time as unknown as Time, d.points[1].price);
          if (p1 && p2) {
            const dist = pointToSegmentDist(px, py, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) return d.id;
          }
        }
      }
    }
    return null;
  }, [drawings, series, toPixel]);

  // Helper: distance from point to line segment
  const pointToSegmentDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1; const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx; const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    if (mode === 'none') {
      // Selection mode: tap near a drawing to select/drag it
      const coord = fromPixel(e.clientX, e.clientY);
      if (!coord) {
        setSelectedDrawingId(null);
        // Passthrough: let chart handle this event
        passthroughToChart(e);
        return;
      }
      const id = findNearestDrawing(coord.x, coord.y);

      if (!id) {
        setSelectedDrawingId(null);
        // Passthrough: let chart handle zoom/pan
        passthroughToChart(e);
        return;
      }

      setSelectedDrawingId(id);

      // Start drag if we found a drawing
      if (onUpdateDrawing) {
        const drawing = drawings.find(d => d.id === id);
        if (drawing && !drawing.locked) {
          isDragging.current = true;
          dragStartCoord.current = { time: coord.time, price: coord.price };
          dragSnapshotRef.current = drawings.map(d => ({ ...d, points: d.points?.map(p => ({ ...p })) }));

          if (drawing.points) {
            dragOriginalPoints.current = drawing.points.map(p => ({ ...p }));
            dragPointIndex.current = null;
            for (let i = 0; i < drawing.points.length; i++) {
              const pp = toPixel(drawing.points[i].time as unknown as Time, drawing.points[i].price);
              if (pp && Math.abs(coord.x - pp.x) < 14 && Math.abs(coord.y - pp.y) < 14) {
                dragPointIndex.current = i;
                break;
              }
            }
          }
          if (drawing.price != null) {
            dragOriginalPrice.current = drawing.price;
          }
          (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        }
      }
      scheduleRender();
      return;
    }
    const coord = fromPixel(e.clientX, e.clientY);
    if (!coord) return;

    if (mode === 'eraser') {
      const id = findNearestDrawing(coord.x, coord.y);
      if (id && onRemoveDrawing) { onRemoveDrawing(id); scheduleRender(); }
      return;
    }

    if (mode === 'laser') {
      isDrawing.current = true;
      laserPixels.current = [{ x: coord.x, y: coord.y, t: Date.now() }];
      cancelAnimationFrame(laserRaf.current);
      scheduleRender();
      return;
    }

    if (freeDrawModesInput.includes(mode)) {
      isDrawing.current = true;
      penCoords.current = [{ time: coord.time, price: coord.price }];
      return;
    }

    if (singleClickModes.includes(mode)) {
      const color = defaultColors[mode] || '#ffffff';
      const snapped = snapToOHLC(coord.time, coord.price);
      if (mode === 'hline') {
        onAddDrawing({ id: `${mode}_${Date.now()}`, type: mode, price: snapped.price, color });
      } else {
        const textModes: DrawingMode[] = ['text', 'anchored_text', 'note_box', 'callout'];
        let text: string | undefined;
        if (textModes.includes(mode)) {
          text = prompt('Enter text:') || 'Note';
        }
        onAddDrawing({
          id: `${mode}_${Date.now()}`, type: mode,
          points: [{ time: snapped.time as number, price: snapped.price }],
          color, text,
        });
      }
      onFinishDrawing(); scheduleRender();
      return;
    }

    if (twoPointModes.includes(mode)) {
      isDrawing.current = true;
      const snapped = snapToOHLC(coord.time, coord.price);
      startCoord.current = { time: snapped.time, price: snapped.price };
      currentPixel.current = { x: coord.x, y: coord.y };
      return;
    }
  }, [fromPixel, onAddDrawing, onFinishDrawing, onRemoveDrawing, scheduleRender, drawingModeRef, findNearestDrawing, snapToOHLC, onUpdateDrawing, drawings, toPixel]);

  // Passthrough: temporarily disable overlay so chart gets the gesture
  const passthroughToChart = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.pointerEvents = 'none';
    // Re-dispatch event to element underneath
    const underneath = document.elementFromPoint(e.clientX, e.clientY);
    if (underneath && underneath !== canvas) {
      underneath.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: e.clientX, clientY: e.clientY,
        pointerId: e.pointerId, pointerType: e.pointerType,
        bubbles: true, cancelable: true, isPrimary: e.isPrimary,
      }));
    }
    // Restore on gesture end
    const restore = () => {
      if (canvas) canvas.style.pointerEvents = '';
      window.removeEventListener('pointerup', restore);
      window.removeEventListener('touchend', restore);
    };
    window.addEventListener('pointerup', restore, { once: true });
    window.addEventListener('touchend', restore, { once: true });
    // Safety timeout
    setTimeout(restore, 5000);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    // Handle drag in selection mode
    if (mode === 'none' && isDragging.current && selectedDrawingId && onUpdateDrawing) {
      const coord = fromPixel(e.clientX, e.clientY);
      if (!coord || !dragStartCoord.current) return;
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (!drawing) return;

      const deltaTime = (coord.time as number) - (dragStartCoord.current.time as number);
      const deltaPrice = coord.price - dragStartCoord.current.price;

      if (drawing.points && dragOriginalPoints.current) {
        if (dragPointIndex.current !== null) {
          const newPoints = dragOriginalPoints.current.map((p, i) =>
            i === dragPointIndex.current
              ? { time: p.time + deltaTime, price: p.price + deltaPrice }
              : { ...p }
          );
          onUpdateDrawing(selectedDrawingId, { points: newPoints });
        } else {
          const newPoints = dragOriginalPoints.current.map(p => ({
            time: p.time + deltaTime, price: p.price + deltaPrice,
          }));
          onUpdateDrawing(selectedDrawingId, { points: newPoints });
        }
      } else if (drawing.price != null && dragOriginalPrice.current != null) {
        onUpdateDrawing(selectedDrawingId, { price: dragOriginalPrice.current + deltaPrice });
      }
      scheduleRender();
      return;
    }

    if (mode === 'none' || mode === 'eraser' || !isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;

    if (mode === 'laser') {
      laserPixels.current.push({ x, y, t: Date.now() });
      scheduleRender(); return;
    }
    if (freeDrawModesInput.includes(mode)) {
      const coord = fromPixel(e.clientX, e.clientY);
      if (coord) {
        const snapped = snapToOHLC(coord.time, coord.price);
        penCoords.current.push({ time: snapped.time, price: snapped.price });
      }
      scheduleRender(); return;
    }
    if (magnetMode && twoPointModes.includes(mode)) {
      const coord = fromPixel(e.clientX, e.clientY);
      if (coord) {
        const snapped = snapToOHLC(coord.time, coord.price);
        const snappedPx = toPixel(snapped.time as any, snapped.price);
        if (snappedPx) {
          currentPixel.current = { x: snappedPx.x, y: snappedPx.y };
          scheduleRender(); return;
        }
      }
    }
    currentPixel.current = { x, y };
    scheduleRender();
  }, [fromPixel, scheduleRender, drawingModeRef, magnetMode, snapToOHLC, toPixel, selectedDrawingId, onUpdateDrawing, drawings]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const mode = drawingModeRef.current;
    // Finish drag - commit undo snapshot
    if (isDragging.current) {
      isDragging.current = false;
      if (dragSnapshotRef.current && onCommitDragUndo) {
        onCommitDragUndo(dragSnapshotRef.current);
      }
      dragPointIndex.current = null;
      dragStartCoord.current = null;
      dragOriginalPoints.current = null;
      dragOriginalPrice.current = null;
      dragSnapshotRef.current = null;
      return;
    }
    if (mode === 'eraser') return;
    if (mode === 'laser') {
      isDrawing.current = false;
      const fadeOut = () => {
        laserPixels.current = laserPixels.current.filter(p => Date.now() - p.t < 1500);
        scheduleRender();
        if (laserPixels.current.length > 0) laserRaf.current = requestAnimationFrame(fadeOut);
      };
      laserRaf.current = requestAnimationFrame(fadeOut);
      return;
    }
    if (freeDrawModesInput.includes(mode) && isDrawing.current) {
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
      onFinishDrawing(); scheduleRender(); return;
    }
    if (!isDrawing.current || !startCoord.current) return;
    isDrawing.current = false;
    const coord = fromPixel(e.clientX, e.clientY);
    if (!coord) { startCoord.current = null; return; }

    const snapped = snapToOHLC(coord.time, coord.price);
    const color = defaultColors[mode] || '#ffffff';
    onAddDrawing({
      id: `${mode}_${Date.now()}`, type: mode as any,
      points: [
        { time: startCoord.current.time as number, price: startCoord.current.price },
        { time: snapped.time as number, price: snapped.price },
      ],
      color,
    });
    startCoord.current = null;
    currentPixel.current = null;
    onFinishDrawing(); scheduleRender();
  }, [fromPixel, onAddDrawing, onFinishDrawing, scheduleRender, drawingModeRef, snapToOHLC, onCommitDragUndo]);

  // Subscribe to chart visible range changes
  useEffect(() => {
    if (!chart) return;
    const handler = () => scheduleRender();
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => { chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler); };
  }, [chart, scheduleRender]);

  useEffect(() => { scheduleRender(); }, [drawings, scheduleRender]);
  useEffect(() => () => {
    cancelAnimationFrame(laserRaf.current);
    cancelAnimationFrame(renderRafRef.current);
  }, []);

  const isActive = drawingMode !== 'none';
  const hasDrawings = drawings.length > 0;

  // Get selected drawing pixel position for floating toolbar
  const selectedDrawing = selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;
  const selectedPos = (() => {
    if (!selectedDrawing || !canvasRef.current) return null;
    if (selectedDrawing.points && selectedDrawing.points.length > 0) {
      const p = toPixel(selectedDrawing.points[0].time as unknown as Time, selectedDrawing.points[0].price);
      if (p) return { x: p.x, y: p.y };
    }
    if (selectedDrawing.price != null && series) {
      const y = series.priceToCoordinate(selectedDrawing.price);
      if (y !== null) return { x: 60, y };
    }
    return null;
  })();

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${isActive ? (drawingMode === 'eraser' ? 'cursor-not-allowed' : 'cursor-crosshair') : (hasDrawings ? 'cursor-default' : '')}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: isActive || isDragging.current ? 'none' : 'auto' }}
      />
      {/* Floating selection toolbar */}
      {selectedDrawingId && selectedPos && (
        <div
          className="absolute z-50 flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg px-2 py-1"
          style={{ left: Math.max(4, selectedPos.x - 60), top: Math.max(4, selectedPos.y - 44) }}
        >
          <button
            onClick={() => {
              if (onRemoveDrawing) onRemoveDrawing(selectedDrawingId);
              setSelectedDrawingId(null);
            }}
            className="px-2 py-1 text-[10px] font-mono text-loss hover:bg-loss/10 rounded active:scale-95"
          >
            Delete
          </button>
          <button
            onClick={() => {
              if (selectedDrawing) {
                onAddDrawing({ ...selectedDrawing, id: `${selectedDrawing.type}_clone_${Date.now()}` });
              }
              setSelectedDrawingId(null);
            }}
            className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:bg-accent rounded active:scale-95"
          >
            Clone
          </button>
          <button
            onClick={() => setSelectedDrawingId(null)}
            className="px-1 py-1 text-[10px] font-mono text-muted-foreground hover:bg-accent rounded active:scale-95"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
