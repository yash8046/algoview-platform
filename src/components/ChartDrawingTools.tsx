import { useState } from 'react';
import { Minus, TrendingUp, Trash2, MousePointer } from 'lucide-react';

export type DrawingMode = 'none' | 'hline' | 'trendline';

export interface DrawingLine {
  id: string;
  type: 'hline' | 'trendline';
  price?: number;
  points?: { time: number; price: number }[];
  color: string;
}

interface ChartDrawingToolsProps {
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  drawings: DrawingLine[];
  onClearAll: () => void;
}

export default function ChartDrawingTools({
  activeMode,
  onModeChange,
  drawings,
  onClearAll,
}: ChartDrawingToolsProps) {
  const tools = [
    { mode: 'none' as DrawingMode, icon: MousePointer, label: 'Select' },
    { mode: 'hline' as DrawingMode, icon: Minus, label: 'H-Line' },
    { mode: 'trendline' as DrawingMode, icon: TrendingUp, label: 'Trend' },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-secondary/50 rounded-md p-0.5">
      {tools.map((tool) => (
        <button
          key={tool.mode}
          onClick={() => onModeChange(tool.mode)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-mono transition-colors min-h-[32px] active:scale-95 ${
            activeMode === tool.mode
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title={tool.label}
        >
          <tool.icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tool.label}</span>
        </button>
      ))}
      {drawings.length > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-mono text-loss hover:bg-loss/10 transition-colors min-h-[32px] active:scale-95"
          title="Clear all drawings"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      )}
    </div>
  );
}
