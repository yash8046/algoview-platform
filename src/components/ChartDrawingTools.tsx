import { useState } from 'react';
import { MousePointer, Minus, GripVertical, TrendingUp, Activity, Square, Pencil, Zap, Trash2, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

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
  { mode: 'trendline', icon: TrendingUp, label: 'Trend' },
  { mode: 'fib_retracement', icon: Activity, label: 'Fib' },
  { mode: 'fib_extension', icon: Activity, label: 'Fib Ext' },
  { mode: 'rectangle', icon: Square, label: 'Rect' },
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

  const activeToolLabel = activeMode === 'none'
    ? 'Draw'
    : tools.find(t => t.mode === activeMode)?.label || 'Draw';

  const ActiveIcon = activeMode === 'none'
    ? Pencil
    : tools.find(t => t.mode === activeMode)?.icon || Pencil;

  return (
    <div className="relative">
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
        <span className="hidden sm:inline">{activeToolLabel}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Dropdown panel */}
      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-[200] bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[140px]">
          <div className="flex flex-col gap-0.5">
            {tools.map((tool) => (
              <button
                key={tool.mode}
                onClick={() => {
                  onModeChange(tool.mode);
                  setExpanded(false);
                }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
                  activeMode === tool.mode
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <tool.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{tool.label}</span>
              </button>
            ))}

            {/* Divider */}
            <div className="h-px bg-border my-1" />

            {onTogglePatterns && (
              <button
                onClick={() => {
                  onTogglePatterns();
                  setExpanded(false);
                }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
                  showPatterns
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Patterns</span>
              </button>
            )}

            {drawings.length > 0 && (
              <button
                onClick={() => {
                  onClearAll();
                  setExpanded(false);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-xs font-mono text-loss hover:bg-loss/10 transition-colors w-full text-left active:scale-[0.98]"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
