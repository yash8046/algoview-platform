import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer, Minus, GripVertical, TrendingUp, Activity, Square, Pencil, Zap, Trash2,
  BarChart3, ChevronDown, ChevronRight, Circle, Triangle, Type, ArrowUp, ArrowDown,
  Ruler, Target, Lock, Unlock, Eye, EyeOff, Undo2, Redo2, Magnet, Flag, MessageSquare,
  MoveHorizontal, MoveVertical, ArrowRight, Hash, Columns, Waves, PenTool, Highlighter,
  Eraser, Tag, Crosshair, CornerRightDown, Spline, RotateCcw, StickyNote, Compass,
  ScatterChart, Shield, MapPin, Slash, ChevronsUp
} from 'lucide-react';

export type DrawingMode =
  | 'none'
  // Lines
  | 'hline' | 'vline' | 'trendline' | 'ray' | 'extended_line' | 'arrow_line'
  | 'cross_line' | 'h_ray' | 'info_line'
  | 'v_ray' | 'h_segment' | 'trend_angle' | 'arrow_marker_standalone'
  // Channels
  | 'parallel_channel' | 'disjoint_channel' | 'pitchfork'
  | 'regression_channel' | 'flat_channel' | 'schiff_pitchfork' | 'inside_pitchfork'
  // Fibonacci
  | 'fib_retracement' | 'fib_extension' | 'fib_fan' | 'fib_arc' | 'fib_time_zones' | 'fib_channel'
  | 'fib_trend_based' | 'fib_speed_resistance' | 'fib_spiral' | 'fib_wedge'
  // Shapes
  | 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'polyline' | 'arc'
  | 'rotated_rectangle' | 'bezier_curve' | 'path_tool'
  // Draw
  | 'pen' | 'brush' | 'highlighter' | 'laser' | 'eraser'
  // Annotations
  | 'text' | 'callout' | 'arrow_marker_up' | 'arrow_marker_down' | 'flag' | 'price_label'
  | 'anchored_text' | 'note_box'
  // Measure
  | 'price_range' | 'date_range' | 'long_position' | 'short_position'
  | 'bars_pattern' | 'risk_reward'
  ;

export interface DrawingLine {
  id: string;
  type: DrawingMode;
  price?: number;
  points?: { time: number; price: number }[];
  color: string;
  lineWidth?: number;
  opacity?: number;
  text?: string;
  locked?: boolean;
  visible?: boolean;
}

interface ToolDef {
  mode: DrawingMode;
  icon: any;
  label: string;
}

interface ToolCategory {
  name: string;
  icon: any;
  tools: ToolDef[];
}

const categories: ToolCategory[] = [
  {
    name: 'Lines',
    icon: TrendingUp,
    tools: [
      { mode: 'trendline', icon: TrendingUp, label: 'Trend Line' },
      { mode: 'ray', icon: ArrowRight, label: 'Ray' },
      { mode: 'extended_line', icon: MoveHorizontal, label: 'Extended Line' },
      { mode: 'info_line', icon: Ruler, label: 'Info Line' },
      { mode: 'trend_angle', icon: Compass, label: 'Trend Angle' },
      { mode: 'hline', icon: Minus, label: 'Horizontal Line' },
      { mode: 'vline', icon: GripVertical, label: 'Vertical Line' },
      { mode: 'cross_line', icon: Crosshair, label: 'Cross Line' },
      { mode: 'arrow_line', icon: CornerRightDown, label: 'Arrow Line' },
      { mode: 'h_ray', icon: MoveHorizontal, label: 'Horizontal Ray' },
      { mode: 'v_ray', icon: MoveVertical, label: 'Vertical Ray' },
      { mode: 'h_segment', icon: Minus, label: 'H-Segment' },
      { mode: 'arrow_marker_standalone', icon: MapPin, label: 'Arrow Marker' },
    ],
  },
  {
    name: 'Channels',
    icon: Columns,
    tools: [
      { mode: 'parallel_channel', icon: Columns, label: 'Parallel Channel' },
      { mode: 'disjoint_channel', icon: Columns, label: 'Disjoint Channel' },
      { mode: 'regression_channel', icon: ScatterChart, label: 'Regression Channel' },
      { mode: 'flat_channel', icon: Columns, label: 'Flat Top/Bottom' },
      { mode: 'pitchfork', icon: Waves, label: 'Pitchfork' },
      { mode: 'schiff_pitchfork', icon: Waves, label: 'Schiff Pitchfork' },
      { mode: 'inside_pitchfork', icon: Waves, label: 'Inside Pitchfork' },
    ],
  },
  {
    name: 'Fibonacci',
    icon: Activity,
    tools: [
      { mode: 'fib_retracement', icon: Activity, label: 'Fib Retracement' },
      { mode: 'fib_extension', icon: Activity, label: 'Fib Extension' },
      { mode: 'fib_trend_based', icon: Activity, label: 'Trend-Based Fib' },
      { mode: 'fib_fan', icon: Activity, label: 'Fib Fan' },
      { mode: 'fib_arc', icon: Activity, label: 'Fib Arc' },
      { mode: 'fib_speed_resistance', icon: Activity, label: 'Speed Resistance' },
      { mode: 'fib_spiral', icon: Activity, label: 'Fib Spiral' },
      { mode: 'fib_time_zones', icon: Activity, label: 'Fib Time Zones' },
      { mode: 'fib_channel', icon: Activity, label: 'Fib Channel' },
      { mode: 'fib_wedge', icon: Activity, label: 'Fib Wedge' },
    ],
  },
  {
    name: 'Shapes',
    icon: Square,
    tools: [
      { mode: 'rectangle', icon: Square, label: 'Rectangle' },
      { mode: 'rotated_rectangle', icon: RotateCcw, label: 'Rotated Rect' },
      { mode: 'circle', icon: Circle, label: 'Circle' },
      { mode: 'ellipse', icon: Circle, label: 'Ellipse' },
      { mode: 'triangle', icon: Triangle, label: 'Triangle' },
      { mode: 'bezier_curve', icon: Spline, label: 'Bezier Curve' },
      { mode: 'polyline', icon: PenTool, label: 'Polyline' },
      { mode: 'path_tool', icon: PenTool, label: 'Path Tool' },
      { mode: 'arc', icon: Waves, label: 'Arc' },
    ],
  },
  {
    name: 'Draw',
    icon: Pencil,
    tools: [
      { mode: 'pen', icon: Pencil, label: 'Pen' },
      { mode: 'brush', icon: PenTool, label: 'Brush' },
      { mode: 'highlighter', icon: Highlighter, label: 'Highlighter' },
      { mode: 'eraser', icon: Eraser, label: 'Eraser' },
      { mode: 'laser', icon: Zap, label: 'Laser' },
    ],
  },
  {
    name: 'Annotate',
    icon: Type,
    tools: [
      { mode: 'text', icon: Type, label: 'Text' },
      { mode: 'anchored_text', icon: Type, label: 'Anchored Text' },
      { mode: 'note_box', icon: StickyNote, label: 'Note Box' },
      { mode: 'callout', icon: MessageSquare, label: 'Callout' },
      { mode: 'arrow_marker_up', icon: ArrowUp, label: 'Arrow Up' },
      { mode: 'arrow_marker_down', icon: ArrowDown, label: 'Arrow Down' },
      { mode: 'flag', icon: Flag, label: 'Flag' },
      { mode: 'price_label', icon: Tag, label: 'Price Label' },
    ],
  },
  {
    name: 'Measure',
    icon: Ruler,
    tools: [
      { mode: 'price_range', icon: MoveVertical, label: 'Price Range' },
      { mode: 'date_range', icon: MoveHorizontal, label: 'Date Range' },
      { mode: 'bars_pattern', icon: BarChart3, label: 'Bars Pattern' },
      { mode: 'risk_reward', icon: Shield, label: 'Risk/Reward' },
      { mode: 'long_position', icon: ArrowUp, label: 'Long Position' },
      { mode: 'short_position', icon: ArrowDown, label: 'Short Position' },
    ],
  },
];

interface ChartDrawingToolsProps {
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  drawings: DrawingLine[];
  onClearAll: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showPatterns?: boolean;
  onTogglePatterns?: () => void;
}

export default function ChartDrawingTools({
  activeMode,
  onModeChange,
  drawings,
  onClearAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  showPatterns,
  onTogglePatterns,
}: ChartDrawingToolsProps) {
  const [expanded, setExpanded] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxH: number } | null>(null);

  useEffect(() => {
    if (!expanded || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const padding = 8;
    const spaceBelow = window.innerHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;
    if (spaceBelow >= 200) {
      setPosition({ top: rect.bottom + 4, left: Math.max(padding, rect.left), maxH: spaceBelow });
    } else if (spaceAbove >= 200) {
      const maxH = spaceAbove;
      setPosition({ top: Math.max(padding, rect.top - Math.min(maxH, 500) - 4), left: Math.max(padding, rect.left), maxH });
    } else {
      setPosition({ top: padding, left: Math.max(padding, rect.left), maxH: window.innerHeight - padding * 2 });
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setExpanded(false);
        setOpenCategory(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [expanded]);

  // Find active tool label
  const activeLabel = (() => {
    if (activeMode === 'none') return 'Draw';
    for (const cat of categories) {
      const t = cat.tools.find(t => t.mode === activeMode);
      if (t) return t.label;
    }
    return 'Draw';
  })();

  const activeIcon = (() => {
    if (activeMode === 'none') return MousePointer;
    for (const cat of categories) {
      const t = cat.tools.find(t => t.mode === activeMode);
      if (t) return t.icon;
    }
    return MousePointer;
  })();
  const ActiveIcon = activeIcon;

  const dropdown = expanded && position ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl overflow-y-auto overscroll-contain scrollbar-thin touch-pan-y"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: Math.min(position.maxH, 500),
        width: 220,
        WebkitOverflowScrolling: 'touch' as any,
      }}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col p-1">
        {/* Select / None */}
        <button
          onClick={() => { onModeChange('none'); setExpanded(false); setOpenCategory(null); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
            activeMode === 'none' ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <MousePointer className="w-4 h-4 flex-shrink-0" />
          <span>Select</span>
        </button>

        <div className="h-px bg-border my-1" />

        {/* Categories */}
        {categories.map((cat) => {
          const isOpen = openCategory === cat.name;
          const hasTool = cat.tools.some(t => t.mode === activeMode);
          const CatIcon = cat.icon;

          return (
            <div key={cat.name}>
              <button
                onClick={() => setOpenCategory(isOpen ? null : cat.name)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded text-xs font-mono transition-colors active:scale-[0.98] ${
                  hasTool ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <CatIcon className="w-4 h-4 flex-shrink-0" />
                  {cat.name}
                </span>
                <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>

              {isOpen && (
                <div className="ml-3 border-l border-border/50 pl-1">
                  {cat.tools.map((tool) => (
                    <button
                      key={tool.mode}
                      onClick={() => {
                        onModeChange(tool.mode);
                        setExpanded(false);
                        setOpenCategory(null);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-[11px] font-mono transition-colors w-full text-left active:scale-[0.98] ${
                        activeMode === tool.mode
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <tool.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{tool.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="h-px bg-border my-1" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 px-2 py-1">
          <button
            onClick={() => { onUndo?.(); }}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-mono transition-colors active:scale-[0.98] disabled:opacity-30 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
          <button
            onClick={() => { onRedo?.(); }}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-mono transition-colors active:scale-[0.98] disabled:opacity-30 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Redo2 className="w-3.5 h-3.5" /> Redo
          </button>
        </div>

        <div className="h-px bg-border my-1" />

        {onTogglePatterns && (
          <button
            onClick={() => { onTogglePatterns(); setExpanded(false); }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors w-full text-left active:scale-[0.98] ${
              showPatterns ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span>Patterns</span>
          </button>
        )}

        {drawings.length > 0 && (
          <button
            onClick={() => { onClearAll(); setExpanded(false); }}
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
        <span className="hidden sm:inline">{activeMode === 'none' ? 'Draw' : activeLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}
