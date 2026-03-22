import { MousePointer, Minus, GripVertical, TrendingUp, Activity, Square, Pencil, Zap, Trash2, BarChart3 } from 'lucide-react';

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
  return (
    <div className="flex items-center gap-0.5 bg-secondary/50 rounded-md p-0.5 overflow-x-auto scrollbar-none">
      {tools.map((tool) => (
        <button
          key={tool.mode}
          onClick={() => onModeChange(tool.mode)}
          className={`flex items-center gap-0.5 px-1.5 py-1.5 rounded text-[10px] font-mono transition-colors min-h-[32px] min-w-[32px] justify-center active:scale-95 flex-shrink-0 ${
            activeMode === tool.mode
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title={tool.label}
        >
          <tool.icon className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{tool.label}</span>
        </button>
      ))}
      {onTogglePatterns && (
        <button
          onClick={onTogglePatterns}
          className={`flex items-center gap-0.5 px-1.5 py-1.5 rounded text-[10px] font-mono transition-colors min-h-[32px] min-w-[32px] justify-center active:scale-95 flex-shrink-0 ${
            showPatterns
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title="Candlestick Patterns"
        >
          <CandlestickChart className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Patterns</span>
        </button>
      )}
      {drawings.length > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-0.5 px-1.5 py-1.5 rounded text-[10px] font-mono text-loss hover:bg-loss/10 transition-colors min-h-[32px] min-w-[32px] justify-center active:scale-95 flex-shrink-0"
          title="Clear all drawings"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Clear</span>
        </button>
      )}
    </div>
  );
}
