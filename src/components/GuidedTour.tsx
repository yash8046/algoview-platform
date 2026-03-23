import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="portfolio"]',
    title: '💼 Your Portfolio',
    description: 'Track your simulated balance, total P&L, and portfolio performance at a glance.',
    position: 'bottom',
  },
  {
    target: '[data-tour="chart"]',
    title: '📊 Live Market Chart',
    description: 'Real-time candlestick charts with SMA indicators, drawing tools, and multiple timeframes.',
    position: 'bottom',
  },
  {
    target: '[data-tour="trade-panel"]',
    title: '🎯 Simulate a Trade',
    description: 'Enter buy/sell orders with custom quantities. All trades use virtual money — no real funds involved.',
    position: 'left',
  },
  {
    target: '[data-tour="ai-signals"]',
    title: '🤖 AI Insights',
    description: 'Get AI-powered analysis with confidence scores, support/resistance levels, and actionable signals.',
    position: 'left',
  },
  {
    target: '[data-tour="watchlist"]',
    title: '👀 Watchlist',
    description: 'Monitor your favorite stocks with real-time prices. Tap any stock to view its chart.',
    position: 'right',
  },
];

function getTooltipStyle(el: HTMLElement, position: string): React.CSSProperties {
  const rect = el.getBoundingClientRect();
  const base: React.CSSProperties = { position: 'fixed', zIndex: 10002 };

  switch (position) {
    case 'bottom':
      return { ...base, top: rect.bottom + 12, left: Math.max(12, rect.left), maxWidth: Math.min(320, window.innerWidth - 24) };
    case 'top':
      return { ...base, bottom: window.innerHeight - rect.top + 12, left: Math.max(12, rect.left), maxWidth: Math.min(320, window.innerWidth - 24) };
    case 'left':
      return { ...base, top: rect.top, right: window.innerWidth - rect.left + 12, maxWidth: 280 };
    case 'right':
      return { ...base, top: rect.top, left: rect.right + 12, maxWidth: 280 };
    default:
      return { ...base, top: rect.bottom + 12, left: rect.left };
  }
}

export default function GuidedTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const seen = localStorage.getItem('tour_completed');
    if (!seen) {
      // Delay to let DOM render
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const currentStep = TOUR_STEPS[step];

  const updatePosition = useCallback(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector(currentStep.target) as HTMLElement;
    if (el) {
      setTooltipStyle(getTooltipStyle(el, currentStep.position));
    }
  }, [active, step, currentStep]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [updatePosition]);

  const finish = () => {
    localStorage.setItem('tour_completed', 'true');
    setActive(false);
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const prev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  if (!active) return null;

  const targetEl = document.querySelector(currentStep.target) as HTMLElement;
  const highlightStyle: React.CSSProperties = targetEl
    ? {
        position: 'fixed',
        top: targetEl.getBoundingClientRect().top - 4,
        left: targetEl.getBoundingClientRect().left - 4,
        width: targetEl.getBoundingClientRect().width + 8,
        height: targetEl.getBoundingClientRect().height + 8,
        borderRadius: '8px',
        border: '2px solid hsl(var(--primary))',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
        zIndex: 10001,
        pointerEvents: 'none' as const,
      }
    : {};

  return (
    <>
      {/* Highlight ring */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <div style={tooltipStyle} className="bg-card border border-primary/30 rounded-xl shadow-2xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">{currentStep.title}</h3>
          <button onClick={finish} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button onClick={prev} className="flex items-center gap-0.5 px-2 py-1 text-[10px] rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button onClick={next} className="flex items-center gap-0.5 px-3 py-1 text-[10px] rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-colors active:scale-95">
              {step === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        <button onClick={finish} className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          Skip tour
        </button>
      </div>
    </>
  );
}
