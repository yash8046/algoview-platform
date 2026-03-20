import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Shield, Target, AlertTriangle, Zap } from 'lucide-react';
import { useAIAnalysis, type AIAnalysisResult } from '@/hooks/useAIAnalysis';
import { useCryptoData } from '@/hooks/useCryptoData';
import { useCryptoStore } from '@/stores/cryptoStore';
import { useEffect, useRef } from 'react';

const signalConfig = {
  buy: { icon: TrendingUp, color: 'text-gain', bg: 'bg-gain/10', border: 'border-gain/20', label: 'BUY' },
  sell: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/20', label: 'SELL' },
  hold: { icon: Minus, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', label: 'HOLD' },
};

const riskConfig = {
  low: { color: 'text-gain', label: 'Low Risk' },
  medium: { color: 'text-warning', label: 'Med Risk' },
  high: { color: 'text-loss', label: 'High Risk' },
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

function SignalCard({ result }: { result: AIAnalysisResult }) {
  const ensemble = result.ensembleSignal;
  const ai = result.aiSignal;
  const rule = result.ruleBasedSignal;
  const prediction = result.prediction;
  const cfg = signalConfig[ensemble.signal as keyof typeof signalConfig] || signalConfig.hold;
  const Icon = cfg.icon;
  const risk = riskConfig[ai.riskLevel as keyof typeof riskConfig] || riskConfig.medium;

  return (
    <div className="space-y-3">
      {/* Main ensemble signal */}
      <div className={`p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${cfg.color}`} />
            <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] ${risk.color} font-medium`}>{risk.label}</span>
            <span className={`text-xs font-mono font-bold ${cfg.color}`}>
              {Math.round(ensemble.confidence * 100)}%
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{ensemble.reasoning}</p>
        <div className="flex items-center gap-1 mt-1.5">
          <Zap className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[9px] text-muted-foreground/60 font-mono uppercase">{ensemble.method.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Prediction */}
      <div className="p-2.5 rounded-md bg-secondary/50 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">Predicted Move</span>
          </div>
          <span className={`text-[11px] font-mono font-semibold ${
            prediction.direction === 'up' ? 'text-gain' : prediction.direction === 'down' ? 'text-loss' : 'text-muted-foreground'
          }`}>
            {prediction.direction === 'up' ? '↑' : prediction.direction === 'down' ? '↓' : '→'} ${prediction.predicted.toFixed(2)}
          </span>
        </div>
        {ai.targetPrice && (
          <div className="flex justify-between mt-1.5 text-[10px]">
            <span className="text-muted-foreground">Target</span>
            <span className="font-mono text-gain">${ai.targetPrice.toFixed(2)}</span>
          </div>
        )}
        {ai.stopLoss && (
          <div className="flex justify-between mt-0.5 text-[10px]">
            <span className="text-muted-foreground">Stop Loss</span>
            <span className="font-mono text-loss">${ai.stopLoss.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Confidence breakdown */}
      <div className="space-y-2">
        <ConfidenceBar value={rule.confidence} label="Technical Analysis" />
        <ConfidenceBar value={ai.confidence} label="AI Model" />
        <ConfidenceBar value={ensemble.confidence} label="Ensemble" />
      </div>

      {/* Key indicators */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'RSI', value: rule.indicators.rsi?.toFixed(1), warn: rule.indicators.rsi > 70 || rule.indicators.rsi < 30 },
          { label: 'MACD', value: rule.indicators.macd?.toFixed(4), warn: false },
          { label: 'ATR', value: rule.indicators.atr?.toFixed(4), warn: false },
          { label: 'Vol', value: rule.indicators.volatility?.toFixed(4), warn: rule.indicators.volatility > 0.03 },
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
          {(ensemble.factors || []).slice(0, 4).map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
              <span className="text-muted-foreground/60 mt-0.5">•</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CryptoAISignals() {
  const { selectedPair, selectedInterval } = useCryptoStore();
  const { candles } = useCryptoData(selectedPair, selectedInterval);
  const { analysis, loading, error, analyze } = useAIAnalysis();
  const lastAnalyzed = useRef<string>('');

  // Auto-analyze when candles are ready or pair changes
  useEffect(() => {
    const key = `${selectedPair}-${selectedInterval}`;
    if (candles.length >= 50 && key !== lastAnalyzed.current) {
      lastAnalyzed.current = key;
      analyze(candles, selectedPair, selectedInterval);
    }
  }, [candles.length, selectedPair, selectedInterval]);

  // Auto-refresh every 5 seconds for crypto
  useEffect(() => {
    const interval = setInterval(() => {
      if (candles.length >= 50) {
        analyze(candles, selectedPair, selectedInterval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [candles, selectedPair, selectedInterval, analyze]);

  const handleRefresh = () => {
    if (candles.length >= 50) {
      lastAnalyzed.current = '';
      analyze(candles, selectedPair, selectedInterval);
    }
  };

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden h-full">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI Analysis</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">LIVE</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
          title="Refresh analysis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {loading && !analysis && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Analyzing {selectedPair}...</span>
            <span className="text-[10px] text-muted-foreground/60">Computing indicators & AI prediction</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-2 rounded bg-warning/10 border border-warning/20 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <span className="text-[10px] text-warning">{error}</span>
          </div>
        )}
        {analysis && <SignalCard result={analysis} />}
        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Shield className="w-8 h-8 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Waiting for market data...</span>
          </div>
        )}
        {analysis && (
          <div className="mt-3 pt-2 border-t border-border">
            <span className="text-[9px] text-muted-foreground/50 font-mono">
              Updated: {new Date(analysis.timestamp).toLocaleTimeString()} • Auto-refresh 5s • Not financial advice
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
