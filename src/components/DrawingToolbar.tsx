import { useState } from 'react';

const PALETTE = [
  '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#6b7a99',
];
const LINE_WIDTHS = [1, 1.5, 2, 3, 5];

interface DrawingToolbarProps {
  color: string;
  lineWidth: number;
  onColorChange: (color: string) => void;
  onLineWidthChange: (w: number) => void;
  onDelete: () => void;
  onClone: () => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export default function DrawingToolbar({
  color, lineWidth, onColorChange, onLineWidthChange,
  onDelete, onClone, onClose, style,
}: DrawingToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const [showWidths, setShowWidths] = useState(false);

  return (
    <div
      className="absolute z-50 flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg px-1.5 py-1"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Color swatch button */}
      <div className="relative">
        <button
          onClick={() => { setShowColors(p => !p); setShowWidths(false); }}
          className="w-6 h-6 rounded border border-border active:scale-90 transition-transform"
          style={{ backgroundColor: color }}
          title="Color"
        />
        {showColors && (
          <div className="absolute top-full left-0 mt-1 grid grid-cols-5 gap-1 bg-card border border-border rounded-lg p-1.5 shadow-xl z-50">
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => { onColorChange(c); setShowColors(false); }}
                className={`w-6 h-6 rounded-sm border transition-transform active:scale-90 ${c === color ? 'border-primary ring-1 ring-primary' : 'border-border/50'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Line width button */}
      <div className="relative">
        <button
          onClick={() => { setShowWidths(p => !p); setShowColors(false); }}
          className="flex items-center justify-center w-6 h-6 rounded border border-border text-[9px] font-mono text-foreground hover:bg-accent active:scale-90 transition-transform"
          title="Line width"
        >
          <div className="rounded-full bg-foreground" style={{ width: Math.max(8, lineWidth * 4), height: Math.min(lineWidth * 1.5, 6) }} />
        </button>
        {showWidths && (
          <div className="absolute top-full left-0 mt-1 flex flex-col gap-0.5 bg-card border border-border rounded-lg p-1.5 shadow-xl z-50">
            {LINE_WIDTHS.map(w => (
              <button
                key={w}
                onClick={() => { onLineWidthChange(w); setShowWidths(false); }}
                className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono transition-colors active:scale-95 ${w === lineWidth ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
              >
                <div className="rounded-full bg-current" style={{ width: 20, height: Math.max(1, w) }} />
                <span>{w}px</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-0.5" />

      <button
        onClick={onClone}
        className="px-1.5 py-1 text-[10px] font-mono text-muted-foreground hover:bg-accent rounded active:scale-95"
      >
        Clone
      </button>
      <button
        onClick={onDelete}
        className="px-1.5 py-1 text-[10px] font-mono text-loss hover:bg-loss/10 rounded active:scale-95"
      >
        Delete
      </button>
      <button
        onClick={onClose}
        className="px-1 py-1 text-[10px] font-mono text-muted-foreground hover:bg-accent rounded active:scale-95"
      >
        ✕
      </button>
    </div>
  );
}
