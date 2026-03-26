import { useState, useEffect } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';

export function DisclaimerBanner() {
  return (
    <div className="bg-warning/10 border-b border-warning/20 px-3 py-1.5 flex items-center gap-2 text-[10px] text-warning" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 4px)' }}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span className="flex-1">This app provides AI-generated market insights for informational and educational purposes only. It does not constitute financial advice.</span>
    </div>
  );
}

export function FirstUseDisclaimer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('disclaimer_accepted');
    if (!dismissed) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem('disclaimer_accepted', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/15">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Important Disclaimer</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>⚠️ AI-generated insights are <strong className="text-foreground">probabilistic and may be inaccurate</strong>.</p>
          <p>Do not rely solely on this information for financial decisions. This application is a <strong className="text-foreground">market research and analysis tool</strong> only.</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>All trading simulations use virtual money only</li>
            <li>No real money is involved in any transaction</li>
            <li>Past performance does not guarantee future results</li>
            <li>Always consult a qualified financial advisor</li>
          </ul>
        </div>
        <button
          onClick={accept}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          I Understand — Continue
        </button>
      </div>
    </div>
  );
}

export function DisclaimerPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Info className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Disclaimer & Terms</h1>
      </div>
      <div className="bg-card rounded-lg border border-border p-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h3 className="text-foreground font-semibold mb-2">Market Analysis Tool</h3>
          <p>This application is an AI-powered market research and analysis dashboard. It provides probabilistic insights based on technical indicators, sentiment analysis, and machine learning models.</p>
        </section>
        <section>
          <h3 className="text-foreground font-semibold mb-2">Not Financial Advice</h3>
          <p>Nothing in this application constitutes financial advice, investment recommendation, or solicitation to buy or sell any financial instrument. All outputs are for informational and educational purposes only.</p>
        </section>
        <section>
          <h3 className="text-foreground font-semibold mb-2">Simulation Mode</h3>
          <p>All trading features operate in simulation mode using virtual currency. No real money is involved. Paper trading results do not reflect real market conditions including slippage, liquidity, and execution delays.</p>
        </section>
        <section>
          <h3 className="text-foreground font-semibold mb-2">AI Model Limitations</h3>
          <p>AI-generated insights are experimental model outputs. They are probabilistic in nature and may be inaccurate. The models may not account for all market factors, breaking news, or black swan events.</p>
        </section>
        <section>
          <h3 className="text-foreground font-semibold mb-2">Risk Warning</h3>
          <p>Financial markets carry inherent risk. Past performance does not guarantee future results. Always conduct your own research and consult a qualified financial advisor before making investment decisions.</p>
        </section>
      </div>
    </div>
  );
}
