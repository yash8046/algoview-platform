import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer, Minus, GripVertical, TrendingUp, Activity, Square, Pencil, Zap, Trash2, BarChart3, ChevronDown } from 'lucide-react';

export type DrawingMode = 'none' | 'hline' | 'vline' | 'trendline' | 'fib_retracement' | 'fib_extension' | 'rectangle' | 'pen' | 'laser';

export interface DrawingLine {
  id: string;
  type: 'hline' | 'vline' | 'trendline' | 'fib_retracement' | 'fib_extension' | 'rectangle' | 'pen';
  price?: number;
  points?: { time: number; price: number }[];
  color: string;
}

interface ChartDrawingToolsProps {
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  drawings: DrawingLine[];
  onClearAll: () => void;
  showPatterns?: boolean;
  onTogglePatterns?: () => void;
}

const tools: { mode: DrawingMode; icon: any; label: string }[] = [
  { mode: 'none', icon: MousePointer, label: 'Select' },
  { mode: 'hline', icon: Minus, label: 'H-Line' },
  { mode: 'vline', icon: GripVertical, label: 'V-Line' },
  { mode: 'trendline', icon: TrendingUp, label: 'Trendline' },
  { mode: 'fib_retracement', icon: Activity, label: 'Fibonacci' },
  { mode: 'fib_extension', icon: Activity, label: 'Fib Extension' },
  { mode: 'rectangle', icon: Square, label: 'Rectangle' },
  { mode: 'pen', icon: Pencil, label: 'Pen' },
  { mode: 'laser', icon: Zap, label: 'Laser' },
];

export default function ChartDrawingTools({
  activeMode,
  onModeChange,
  drawings,
  onClearAll,
  showPatterns,
  onTogglePatterns,
}: ChartDrawingToolsProps) {
  const [expanded, setExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxH: number } | null>(null);

  // Calculate position when expanded
  useEffect(() => {
    if (!expanded || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const padding = 8; // margin from viewport edges
    const spaceBelow = window.innerHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    if (spaceBelow >= 200) {
      // Open downward, cap height to available space
      setPosition({ top: rect.bottom + 4, left: Math.max(padding, rect.left), maxH: spaceBelow });
    } else if (spaceAbove >= 200) {
      // Open upward
      const maxH = spaceAbove;
      setPosition({ top: Math.max(padding, rect.top - Math.min(maxH, 400) - 4), left: Math.max(padding, rect.left), maxH });
    } else {
      // Fallback: center vertically
      const maxH = window.innerHeight - padding * 2;
      setPosition({ top: padding, left: Math.max(padding, rect.left), maxH });
    }
  }, [expanded]);

  // Close on click outside (support touch)
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [expanded]);

  const activeTool = tools.find(t => t.mode === activeMode) || tools[0];
  const ActiveIcon = activeTool.icon;

  const dropdown = expanded && position ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl min-w-[160px] overflow-y-auto overscroll-contain scrollbar-thin touch-pan-y"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: Math.min(position.maxH, 400),
        WebkitOverflowScrolling: 'touch' as any,
      }}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col p-1">
        {tools.map((tool) => (
          <button
            key={tool.mode}
            onClick={() => {
              onModeChange(tool.mode);
              setExpanded(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
              activeMode === tool.mode
                ? 'bg-primary/20 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <tool.icon className="w-4 h-4 flex-shrink-0" />
            <span>{tool.label}</span>
          </button>
        ))}

        <div className="h-px bg-border my-1" />

        {onTogglePatterns && (
          <button
            onClick={() => {
              onTogglePatterns();
              setExpanded(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
              showPatterns
                ? 'bg-primary/20 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span>Patterns</span>
          </button>
        )}

        {drawings.length > 0 && (
          <button
            onClick={() => {
              onClearAll();
              setExpanded(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono text-loss hover:bg-loss/10 transition-colors w-full text-left active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            <span>Clear All ({drawings.length})</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setExpanded(prev => !prev)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-[10px] sm:text-xs font-mono transition-colors min-h-[32px] active:scale-95 ${
          activeMode !== 'none'
            ? 'bg-primary/20 text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Drawing tools"
      >
        <ActiveIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{activeMode === 'none' ? 'Draw' : activeTool.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}
