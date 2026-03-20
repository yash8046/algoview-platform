import { useTradingStore } from '@/stores/tradingStore';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface HoldingRow {
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
}

export default function Portfolio() {
  const { balance, initialBalance, positions, trades, watchlist, updatePrice } = useTradingStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh prices every 30s
  useEffect(() => {
    const refresh = async () => {
      for (const pos of positions) {
        try {
          const data = await fetchYahooFinanceData(pos.symbol, '1D');
          if (data.regularMarketPrice) {
            updatePrice(pos.symbol, data.regularMarketPrice, data.previousClose || data.regularMarketPrice);
          }
        } catch (e) {
          console.warn(`Failed to refresh ${pos.symbol}`, e);
        }
      }
      setLastUpdated(new Date());
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [positions.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const data = await fetchYahooFinanceData(pos.symbol, '1D');
        if (data.regularMarketPrice) {
          updatePrice(pos.symbol, data.regularMarketPrice, data.previousClose || data.regularMarketPrice);
        }
      } catch (e) { /* skip */ }
    }
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  // Build holdings
  const holdings: HoldingRow[] = positions.map(pos => {
    const wItem = watchlist.find(w => w.symbol === pos.symbol);
    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
    const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    return {
      symbol: pos.symbol,
      name: wItem?.name || pos.symbol,
      qty: pos.quantity,
      avgPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      pnl,
      pnlPercent,
      value: pos.currentPrice * pos.quantity,
    };
  });

  const investedValue = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const currentValue = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const unrealizedPnl = currentValue - investedValue;
  const realizedPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;
  const portfolioValue = balance + currentValue;
  const returnPercent = ((portfolioValue - initialBalance) / initialBalance) * 100;
  const dayPnl = watchlist.reduce((sum, w) => {
    const pos = positions.find(p => p.symbol === w.symbol);
    if (!pos) return sum;
    return sum + w.change * pos.quantity;
  }, 0);

  const summaryCards = [
    { label: 'Portfolio Value', value: formatINR(portfolioValue), icon: DollarSign, positive: portfolioValue >= initialBalance, sub: `${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%` },
    { label: 'Invested', value: formatINR(investedValue), icon: PieChart, positive: true, sub: `${positions.length} holdings` },
    { label: 'Current Value', value: formatINR(currentValue), icon: BarChart3, positive: unrealizedPnl >= 0, sub: `${unrealizedPnl >= 0 ? '+' : ''}${formatINR(unrealizedPnl)}` },
    { label: "Today's P&L", value: `${dayPnl >= 0 ? '+' : ''}${formatINR(Math.abs(dayPnl))}`, icon: dayPnl >= 0 ? TrendingUp : TrendingDown, positive: dayPnl >= 0, sub: 'Unrealized' },
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}${formatINR(Math.abs(totalPnl))}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: totalPnl >= 0, sub: `Realized: ${formatINR(realizedPnl)}` },
    { label: 'Cash Available', value: formatINR(balance), icon: DollarSign, positive: true, sub: `${((balance / portfolioValue) * 100).toFixed(1)}% of portfolio` },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Trading
          </Link>
          <h1 className="text-lg font-bold text-foreground">Portfolio Overview</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
            REAL-TIME
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-[10px] text-muted-foreground font-mono">
            Updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {summaryCards.map(card => (
            <div key={card.label} className="bg-card rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{card.label}</span>
                <div className={`p-1.5 rounded-md ${card.positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
                  <card.icon className={`w-3.5 h-3.5 ${card.positive ? 'text-gain' : 'text-loss'}`} />
                </div>
              </div>
              <div className={`font-mono text-base font-bold ${card.positive ? 'text-gain' : 'text-loss'}`}>
                {card.value}
              </div>
              <div className="text-[10px] text-muted-foreground">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Holdings Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-panel-header border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Holdings</h2>
            <span className="text-[11px] text-muted-foreground">{holdings.length} stocks</span>
          </div>
          {holdings.length === 0 ? (
            <div className="p-12 text-center">
              <PieChart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No holdings yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Buy stocks from the trading page to see them here</p>
              <Link to="/" className="inline-block mt-4 text-xs text-primary hover:underline">
                Go to Trading →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium">Stock</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">LTP</th>
                    <th className="px-4 py-2.5 text-right font-medium">Invested</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current</th>
                    <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                    <th className="px-4 py-2.5 text-right font-medium">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr key={h.symbol} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-foreground">{h.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">{h.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{h.qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(h.avgPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(h.currentPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(h.avgPrice * h.qty)}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(h.value)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${h.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {h.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {h.pnl >= 0 ? '+' : ''}{formatINR(Math.abs(h.pnl))}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${h.pnlPercent >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5 text-foreground">Total</td>
                    <td className="px-4 py-2.5"></td>
                    <td className="px-4 py-2.5"></td>
                    <td className="px-4 py-2.5"></td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatINR(investedValue)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatINR(currentValue)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${unrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {unrealizedPnl >= 0 ? '+' : ''}{formatINR(Math.abs(unrealizedPnl))}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${unrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {investedValue > 0 ? `${((unrealizedPnl / investedValue) * 100).toFixed(2)}%` : '0.00%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-panel-header border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Trades</h2>
            <span className="text-[11px] text-muted-foreground">{trades.length} total</span>
          </div>
          {trades.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No trades executed yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2.5 text-left font-medium">Side</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 20).map(t => (
                  <tr key={t.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2 font-mono text-muted-foreground">
                      {new Date(t.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2 font-mono font-semibold text-foreground">{t.symbol}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.side === 'buy' ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{formatINR(t.price)}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{t.quantity}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{formatINR(t.total)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${(t.pnl || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {t.pnl !== undefined ? `${t.pnl >= 0 ? '+' : ''}${formatINR(Math.abs(t.pnl))}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
