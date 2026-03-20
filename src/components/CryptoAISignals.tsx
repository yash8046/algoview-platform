import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const signals = [
  { pair: 'BTC/USDT', signal: 'buy' as const, confidence: 0.89, model: 'LSTM', reason: 'Bullish divergence on 4H RSI, support bounce at $67,000' },
  { pair: 'ETH/USDT', signal: 'hold' as const, confidence: 0.62, model: 'XGBoost', reason: 'Consolidation near $3,400 resistance, awaiting breakout' },
  { pair: 'SOL/USDT', signal: 'buy' as const, confidence: 0.91, model: 'RL Agent', reason: 'Strong momentum above 200 EMA with volume spike' },
  { pair: 'BNB/USDT', signal: 'sell' as const, confidence: 0.75, model: 'Transformer', reason: 'Bearish engulfing on daily, RSI > 72 overbought zone' },
  { pair: 'XRP/USDT', signal: 'buy' as const, confidence: 0.83, model: 'LSTM', reason: 'Breakout above $0.62 with above-average volume' },
];

const signalConfig = {
  buy: { icon: TrendingUp, color: 'text-gain', bg: 'bg-gain/10', border: 'border-gain/20' },
  sell: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/20' },
  hold: { icon: Minus, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
};

export default function CryptoAISignals() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden h-full">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
        <Brain className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Signals</h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">CRYPTO</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {signals.map((s, i) => {
          const cfg = signalConfig[s.signal];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`px-4 py-3 border-b border-border hover:bg-accent/30 transition-colors`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-semibold text-foreground">{s.pair}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {s.signal}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{(s.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.reason}</p>
              <span className="text-[10px] text-muted-foreground/60 font-mono mt-1 block">{s.model}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
