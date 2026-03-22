import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Target, AlertTriangle, Zap, Shield, Newspaper, Users, BarChart3, AlertOctagon, Clock, Activity, Info } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useStockAIAnalysis } from '@/hooks/useStockAIAnalysis';
import { useRewardedAd } from '@/hooks/useRewardedAd';
import type { SentimentData } from '@/hooks/useAIAnalysis';

const signalConfig = {
  strong_buy: { icon: TrendingUp, color: 'text-gain', bg: 'bg-gain/15', border: 'border-gain/30', label: 'STRONG BULLISH' },
  buy: { icon: TrendingUp, color: 'text-gain', bg: 'bg-gain/10', border: 'border-gain/20', label: 'BULLISH BIAS' },
  sell: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/20', label: 'BEARISH BIAS' },
  strong_sell: { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/15', border: 'border-loss/30', label: 'STRONG BEARISH' },
  hold: { icon: Minus, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', label: 'NEUTRAL TREND' },
};

const riskColors = { low: 'text-gain', medium: 'text-warning', high: 'text-loss' };

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

function SentimentScore({ score, label }: { score: number | undefined | null; label: string }) {
  const s = typeof score === 'number' ? score : 0;
  const color = s > 0.1 ? 'text-gain' : s < -0.1 ? 'text-loss' : 'text-warning';
  const bg = s > 0.1 ? 'bg-gain' : s < -0.1 ? 'bg-loss' : 'bg-warning';
  const pct = Math.round(((s + 1) / 2) * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${color}`}>{s > 0 ? '+' : ''}{s.toFixed(2)}</span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SentimentPanel({ sentiment }: { sentiment: Partial<SentimentData> }) {
  const news = sentiment?.news || { score: 0, label: 'Neutral', topHeadlines: [] };
  const social = sentiment?.social || { score: 0, label: 'Neutral', buzz: 'low' };
  const technical = sentiment?.technical || { score: 0, label: 'Neutral' };
  const finalScore = typeof sentiment?.finalScore === 'number' ? sentiment.finalScore : 0;
  return (
    <div className="p-2.5 rounded-md bg-secondary/30 border border-border space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold text-foreground">Sentiment Analysis</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3 text-muted-foreground" />
          <SentimentScore score={news.score} label={`News — ${news.label}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-muted-foreground" />
          <SentimentScore score={social.score} label={`Social — ${social.label} (${social.buzz} buzz)`} />
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
          <SentimentScore score={technical.score} label={`Technical — ${technical.label}`} />
        </div>
      </div>

      <div className="pt-1.5 border-t border-border/50">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground font-medium">Weighted Final Score</span>
          <span className={`font-mono font-bold ${finalScore > 0.1 ? 'text-gain' : finalScore < -0.1 ? 'text-loss' : 'text-warning'}`}>
            {finalScore > 0 ? '+' : ''}{finalScore.toFixed(3)}
          </span>
        </div>
      </div>

      {sentiment.manipulation_warning && (
        <div className="flex items-start gap-1.5 p-1.5 rounded bg-loss/10 border border-loss/20">
          <AlertOctagon className="w-3 h-3 text-loss flex-shrink-0 mt-0.5" />
          <span className="text-[9px] text-loss">{sentiment.manipulation_warning}</span>
        </div>
      )}

      {news.topHeadlines?.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[9px] text-muted-foreground">Headlines</span>
          {news.topHeadlines.slice(0, 3).map((h, i) => (
            <div key={i} className="text-[9px] text-foreground/70 pl-2 border-l border-border">
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FactorsList({ positive, negative }: { positive: string[]; negative: string[] }) {
  if (!positive.length && !negative.length) return null;
  return (
    <div className="space-y-1.5">
      {positive.length > 0 && (
        <div>
          <span className="text-[10px] text-gain block mb-0.5">⬆ Upward Factors</span>
          {positive.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
              <span className="text-gain mt-0.5">+</span><span>{f}</span>
            </div>
          ))}
        </div>
      )}
      {negative.length > 0 && (
        <div>
          <span className="text-[10px] text-loss block mb-0.5">⬇ Downward Factors</span>
          {negative.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/80">
              <span className="text-loss mt-0.5">−</span><span>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AISignals() {
  const { selectedSymbol, selectedTimeframe } = useTradingStore();
  const { result, loading, error, refresh } = useStockAIAnalysis(selectedSymbol, selectedTimeframe);
  const { gateWithAd } = useRewardedAd('AI Insight');

  const detailedKey = result?.detailedSignal || result?.signal || 'hold';
  const cfg = signalConfig[detailedKey as keyof typeof signalConfig] || signalConfig[result?.signal as keyof typeof signalConfig] || signalConfig.hold;
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden h-full">
      <div className="px-4 py-2 bg-panel-header border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI Insights</h2>
          {result && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">READY</span>}
        </div>
        {result && (
          <button onClick={() => gateWithAd(refresh)} disabled={loading}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Analyzing {selectedSymbol}...</span>
            <span className="text-[10px] text-muted-foreground/60">Computing indicators, sentiment & AI model</span>
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
            {/* AI Insight label */}
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <Info className="w-3 h-3" />
              <span>AI Insight · Experimental Model Output</span>
            </div>

            {/* Main signal - now trend-based */}
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
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  Upward Prob: {Math.round((result.signal === 'buy' || result.signal === 'hold' ? result.confidence : 1 - result.confidence) * 100)}%
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  Downward Prob: {Math.round((result.signal === 'sell' ? result.confidence : 1 - result.confidence) * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{result.reasoning}</p>
            </div>

            {/* Sentiment */}
            {result.sentiment && <SentimentPanel sentiment={result.sentiment} />}

            {/* Factors */}
            <FactorsList positive={result.positiveFactors} negative={result.negativeFactors} />

            {/* Price Range & Time Horizon */}
            {(result.priceRange || result.timeHorizon) && (
              <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 space-y-2">
                {result.priceRange && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-foreground">Expected Price Range</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Range</span>
                      <span className="font-mono text-foreground">₹{result.priceRange.low.toFixed(2)} – ₹{result.priceRange.high.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">% Move</span>
                      <span className={`font-mono ${result.priceRange.lowPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {result.priceRange.lowPct > 0 ? '+' : ''}{result.priceRange.lowPct.toFixed(1)}% to {result.priceRange.highPct > 0 ? '+' : ''}{result.priceRange.highPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
                {result.timeHorizon && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-semibold text-foreground">Time Horizon</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Estimated</span>
                      <span className="font-mono text-foreground">{result.timeHorizon.label}</span>
                    </div>
                    {result.timeHorizon.catalyst && (
                      <div className="flex justify-between text-[10px] mt-0.5">
                        <span className="text-muted-foreground">Catalyst</span>
                        <span className="font-mono text-warning">{result.timeHorizon.catalyst}</span>
                      </div>
                    )}
                  </div>
                )}
                {result.volatilityCategory && (
                  <div className="flex justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Volatility</span>
                    </div>
                    <span className={`font-mono font-medium capitalize ${
                      result.volatilityCategory === 'high' ? 'text-loss' : result.volatilityCategory === 'medium' ? 'text-warning' : 'text-gain'
                    }`}>{result.volatilityCategory}</span>
                  </div>
                )}
              </div>
            )}

            {/* Market Outlook */}
            <div className="p-2.5 rounded-md bg-secondary/50 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Market Outlook</span>
                </div>
                <span className={`text-[11px] font-mono font-semibold ${
                  result.prediction.direction === 'up' ? 'text-gain' : result.prediction.direction === 'down' ? 'text-loss' : 'text-muted-foreground'
                }`}>
                  {result.prediction.direction === 'up' ? '↑ Positive' : result.prediction.direction === 'down' ? '↓ Negative' : '→ Neutral'} · ₹{result.prediction.predicted.toFixed(2)}
                </span>
              </div>
              {result.targetPrice && (
                <div className="flex justify-between mt-1.5 text-[10px]">
                  <span className="text-muted-foreground">Projected Level</span>
                  <span className="font-mono text-gain">₹{result.targetPrice.toFixed(2)}</span>
                </div>
              )}
              {result.stopLoss && (
                <div className="flex justify-between mt-0.5 text-[10px]">
                  <span className="text-muted-foreground">Support Level</span>
                  <span className="font-mono text-loss">₹{result.stopLoss.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Confidence */}
            <ConfidenceBar value={result.confidence} label="Model Confidence" />

            {/* Regime & Risk */}
            {result.regime && (
              <div className="p-2 rounded-md bg-secondary/30 border border-border space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Market Regime</span>
                  <span className="font-mono text-foreground capitalize">{result.regime.regime.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">ADX</span>
                  <span className={`font-mono ${result.regime.adx > 25 ? 'text-gain' : 'text-muted-foreground'}`}>{result.regime.adx.toFixed(1)}</span>
                </div>
                {result.riskMetrics && result.riskMetrics.suggestedStopLoss > 0 && (
                  <>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Support Level</span>
                      <span className="font-mono text-loss">₹{result.riskMetrics.suggestedStopLoss.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Resistance Level</span>
                      <span className="font-mono text-gain">₹{result.riskMetrics.suggestedTakeProfit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Risk:Reward</span>
                      <span className="font-mono text-foreground">{result.riskMetrics.riskRewardRatio.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Indicators */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'RSI', value: result.indicators.rsi?.toFixed(1), warn: result.indicators.rsi > 70 || result.indicators.rsi < 30 },
                { label: 'MACD', value: result.indicators.macd?.toFixed(4), warn: false },
                { label: 'ATR', value: result.indicators.atr?.toFixed(2), warn: false },
                { label: 'ADX', value: result.indicators.adx?.toFixed(1), warn: false },
              ].map(ind => (
                <div key={ind.label} className="flex justify-between bg-secondary/30 rounded px-2 py-1">
                  <span className="text-[10px] text-muted-foreground">{ind.label}</span>
                  <span className={`text-[10px] font-mono ${ind.warn ? 'text-warning' : 'text-foreground'}`}>{ind.value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  Updated: {new Date(result.timestamp).toLocaleTimeString()} • Cached 5min • For informational purposes only
                </span>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Shield className="w-10 h-10 text-muted-foreground/20" />
            <span className="text-xs text-muted-foreground">{selectedSymbol} ready for analysis</span>
            <button
              onClick={() => gateWithAd(refresh)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              <Brain className="w-4 h-4" />
              Generate Insight
            </button>
            <span className="text-[9px] text-muted-foreground/40">Uses AI + technical indicators + sentiment analysis</span>
          </div>
        )}
      </div>
    </div>
  );
}
