import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Target, AlertTriangle, Zap, Shield } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useStockAIAnalysis } from '@/hooks/useStockAIAnalysis';

const signalConfig = {
  buy: { icon: TrendingUp, color: 'text-gain', bg: 'bg-gain/10', border: 'border-gain/20', label: 'BUY' },
  sell: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/20', label: 'SELL' },
  hold: { icon: Minus, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', label: 'HOLD' },
};

const riskColors = {
  low: 'text-gain',
  medium: 'text-warning',
  high: 'text-loss',
};

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-gain' : pct >= 50 ? 'bg-warning' : 'bg-loss';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AISignals() {
  const { selectedSymbol, selectedTimeframe } = useTradingStore();
  const { result, loading, error, refresh } = useStockAIAnalysis(selectedSymbol, selectedTimeframe, 30000);

  const cfg = result ? (signalConfig[result.signal] || signalConfig.hold) : signalConfig.hold;
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden h-full">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI Signals</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">LIVE</span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
          title="Refresh analysis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Analyzing {selectedSymbol}...</span>
            <span className="text-[10px] text-muted-foreground/60">Computing indicators & AI prediction</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2 rounded bg-warning/10 border border-warning/20 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <span className="text-[10px] text-warning">{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {/* Main signal */}
            <div className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                  <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{selectedSymbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${riskColors[result.riskLevel]} font-medium capitalize`}>{result.riskLevel} Risk</span>
                  <span className={`text-xs font-mono font-bold ${cfg.color}`}>{Math.round(result.confidence * 100)}%</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{result.reasoning}</p>
            </div>

            {/* Prediction */}
            <div className="p-2.5 rounded-md bg-secondary/50 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Predicted Move</span>
                </div>
                <span className={`text-[11px] font-mono font-semibold ${
                  result.prediction.direction === 'up' ? 'text-gain' : result.prediction.direction === 'down' ? 'text-loss' : 'text-muted-foreground'
                }`}>
                  {result.prediction.direction === 'up' ? '↑' : result.prediction.direction === 'down' ? '↓' : '→'} ₹{result.prediction.predicted.toFixed(2)}
                </span>
              </div>
              {result.targetPrice && (
                <div className="flex justify-between mt-1.5 text-[10px]">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-mono text-gain">₹{result.targetPrice.toFixed(2)}</span>
                </div>
              )}
              {result.stopLoss && (
                <div className="flex justify-between mt-0.5 text-[10px]">
                  <span className="text-muted-foreground">Stop Loss</span>
                  <span className="font-mono text-loss">₹{result.stopLoss.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Confidence */}
            <ConfidenceBar value={result.confidence} label="Ensemble Confidence" />

            {/* Indicators */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'RSI', value: result.indicators.rsi?.toFixed(1), warn: result.indicators.rsi > 70 || result.indicators.rsi < 30 },
                { label: 'MACD', value: result.indicators.macd?.toFixed(4), warn: false },
                { label: 'ATR', value: result.indicators.atr?.toFixed(2), warn: false },
                { label: 'Price', value: `₹${result.indicators.price?.toFixed(2)}`, warn: false },
              ].map(ind => (
                <div key={ind.label} className="flex justify-between bg-secondary/30 rounded px-2 py-1">
                  <span className="text-[10px] text-muted-foreground">{ind.label}</span>
                  <span className={`text-[10px] font-mono ${ind.warn ? 'text-warning' : 'text-foreground'}`}>{ind.value}</span>
                </div>
              ))}
            </div>

            {/* Key factors */}
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Key Factors</span>
              <div className="space-y-0.5">
                {result.keyFactors.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  Updated: {new Date(result.timestamp).toLocaleTimeString()} • Auto-refresh 30s • Not financial advice
                </span>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Shield className="w-8 h-8 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Select a stock to analyze</span>
          </div>
        )}
      </div>
    </div>
  );
}
