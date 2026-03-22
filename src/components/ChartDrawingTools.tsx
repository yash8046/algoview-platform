import { useState, useRef, useEffect } from 'react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const activeTool = tools.find(t => t.mode === activeMode) || tools[0];
  const ActiveIcon = activeTool.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toggle button */}
      <button
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

      {/* Dropdown panel */}
      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-[200] bg-card border border-border rounded-lg shadow-xl min-w-[160px] max-h-[320px] overflow-y-auto scrollbar-thin">
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
        </div>
      )}
    </div>
  );
}
