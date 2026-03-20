import { useTradingStore } from '@/stores/tradingStore';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function AISignals() {
  const { aiSignals } = useTradingStore();

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'buy': return <TrendingUp className="w-3.5 h-3.5 text-gain" />;
      case 'sell': return <TrendingDown className="w-3.5 h-3.5 text-loss" />;
      default: return <Minus className="w-3.5 h-3.5 text-warning" />;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'buy': return 'bg-gain/10 text-gain border-gain/30';
      case 'sell': return 'bg-loss/10 text-loss border-loss/30';
      default: return 'bg-warning/10 text-warning border-warning/30';
    }
  };

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Signals</h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">BETA</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {aiSignals.map(signal => (
          <div key={signal.id} className="px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">{signal.symbol}</span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${getSignalColor(signal.signal)}`}>
                  {getSignalIcon(signal.signal)}
                  {signal.signal}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{signal.model}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{signal.reason}</p>
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Confidence:</span>
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${signal.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-primary">{(signal.confidence * 100).toFixed(0)}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {Math.round((Date.now() - signal.timestamp) / 60000)}m ago
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
