import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface TourStep {
  target: string;
  title: string;
  description: string;
  fallbackPosition: 'top' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="portfolio"]',
    title: '💼 Your Portfolio',
    description: 'Track your simulated balance, total P&L, and portfolio performance at a glance.',
    fallbackPosition: 'bottom',
  },
  {
    target: '[data-tour="chart"]',
    title: '📊 Live Market Chart',
    description: 'Real-time candlestick charts with SMA indicators, drawing tools, and multiple timeframes.',
    fallbackPosition: 'bottom',
  },
  {
    target: '[data-tour="trade-panel"]',
    title: '🎯 Simulate a Trade',
    description: 'Place simulated long/short orders with custom quantities. All trades use virtual money — no real funds involved.',
    fallbackPosition: 'bottom',
  },
  {
    target: '[data-tour="ai-signals"]',
    title: '🤖 AI Insights',
    description: 'Get AI-powered analysis with confidence scores, support/resistance levels, and actionable signals.',
    fallbackPosition: 'bottom',
  },
  {
    target: '[data-tour="watchlist"]',
    title: '👀 Watchlist',
    description: 'Monitor your favorite stocks with real-time prices. Tap any stock to view its chart.',
    fallbackPosition: 'bottom',
  },
];

/**
 * Calculate tooltip position that stays within viewport.
 * On mobile/Android, always positions below or above the element,
 * centered horizontally within the screen.
 */
function getTooltipStyle(el: HTMLElement): React.CSSProperties {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = Math.min(300, vw - 24);
  const tooltipH = 160; // approximate

  // Center horizontally on screen
  const left = Math.max(12, (vw - tooltipW) / 2);

  // Prefer below the element, but if not enough space, go above
  const spaceBelow = vh - rect.bottom;
  if (spaceBelow > tooltipH + 16) {
    return {
      position: 'fixed',
      top: rect.bottom + 12,
      left,
      width: tooltipW,
      zIndex: 10002,
    };
  }

  return {
    position: 'fixed',
    bottom: vh - rect.top + 12,
    left,
    width: tooltipW,
    zIndex: 10002,
  };
}

export default function GuidedTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [targetFound, setTargetFound] = useState(false);
  const retryRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const seen = localStorage.getItem('tour_completed');
    if (!seen) {
      const timer = setTimeout(() => setActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const currentStep = TOUR_STEPS[step];

  const updatePosition = useCallback(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector(currentStep.target) as HTMLElement;
    if (el) {
      setTargetFound(true);
      setTooltipStyle(getTooltipStyle(el));
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setTargetFound(false);
    }
  }, [active, step, currentStep]);

  // Retry finding elements (they may render late on Android)
  useEffect(() => {
    updatePosition();

    // Retry a few times for late-rendering elements
    let attempts = 0;
    const tryFind = () => {
      if (attempts >= 5) return;
      attempts++;
      retryRef.current = setTimeout(() => {
        updatePosition();
        if (!document.querySelector(TOUR_STEPS[step]?.target || '')) {
          tryFind();
        }
      }, 500);
    };
    tryFind();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('orientationchange', () => setTimeout(updatePosition, 300));

    return () => {
      window.removeEventListener('resize', updatePosition);
      clearTimeout(retryRef.current);
    };
  }, [updatePosition, step]);

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
      {/* Overlay - tappable to dismiss */}
      <div
        className="fixed inset-0 z-[10000]"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          // Only dismiss if tapping on the overlay background itself
          if (e.target === e.currentTarget) finish();
        }}
      />

      {/* Highlight ring */}
      {targetFound && <div style={highlightStyle} />}

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="bg-card border border-primary/30 rounded-xl shadow-2xl p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">{currentStep.title}</h3>
          <button
            onClick={finish}
            className="p-2 -m-1 text-muted-foreground hover:text-foreground transition-colors"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                style={{ minHeight: 44 }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-colors active:scale-95"
              style={{ minHeight: 44 }}
            >
              {step === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          onClick={finish}
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1"
        >
          Skip tour
        </button>
      </div>
    </>
  );
}
