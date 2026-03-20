import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore } from '@/stores/cryptoStore';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, Bitcoin, LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import TopBar from '@/components/TopBar';

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Portfolio() {
  const { user } = useAuth();
  const { balance, initialBalance, positions, trades, watchlist, updatePrice, loadFromDB: loadStockDB } = useTradingStore();
  const { balance: cryptoBalance, initialBalance: cryptoInitBal, positions: cryptoPositions, trades: cryptoTrades, loadFromDB: loadCryptoDB } = useCryptoStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'stocks' | 'crypto' | 'trades'>('overview');

  useEffect(() => {
    loadStockDB();
    loadCryptoDB();
  }, [user]);

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
    await Promise.all([loadStockDB(), loadCryptoDB()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  // Stock calculations
  const stockInvested = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const stockCurrent = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const stockUnrealizedPnl = stockCurrent - stockInvested;
  const stockRealizedPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);

  // Crypto calculations
  const cryptoInvested = cryptoPositions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const cryptoCurrent = cryptoPositions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const cryptoUnrealizedPnl = cryptoCurrent - cryptoInvested;
  const cryptoRealizedPnl = cryptoTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  // Combined
  const totalPortfolioValue = balance + stockCurrent + cryptoBalance + cryptoCurrent;
  const totalInitial = initialBalance + cryptoInitBal;
  const totalPnl = (stockUnrealizedPnl + stockRealizedPnl) + (cryptoUnrealizedPnl + cryptoRealizedPnl);
  const totalReturn = ((totalPortfolioValue - totalInitial) / totalInitial) * 100;
  const totalTrades = trades.length + cryptoTrades.length;
  const winningTrades = [...trades, ...cryptoTrades].filter(t => (t.pnl ?? 0) > 0).length;
  const losingTrades = [...trades, ...cryptoTrades].filter(t => (t.pnl ?? 0) < 0).length;

  const allTrades = [...trades.map(t => ({ ...t, market: 'stock' as const })), ...cryptoTrades.map(t => ({ ...t, symbol: t.pair, market: 'crypto' as const }))].sort((a, b) => b.timestamp - a.timestamp);

  const summaryCards = [
    { label: 'Total Portfolio', value: formatINR(totalPortfolioValue), icon: DollarSign, positive: totalPortfolioValue >= totalInitial, sub: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}% return` },
    { label: 'Stock Holdings', value: formatINR(stockCurrent), icon: BarChart3, positive: stockUnrealizedPnl >= 0, sub: `${positions.length} positions` },
    { label: 'Crypto Holdings', value: formatINR(cryptoCurrent), icon: Bitcoin, positive: cryptoUnrealizedPnl >= 0, sub: `${cryptoPositions.length} positions` },
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}${formatINR(Math.abs(totalPnl))}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, positive: totalPnl >= 0, sub: `${totalTrades} trades` },
    { label: 'Win Rate', value: totalTrades > 0 ? `${((winningTrades / (winningTrades + losingTrades || 1)) * 100).toFixed(0)}%` : '—', icon: LineChart, positive: winningTrades >= losingTrades, sub: `${winningTrades}W / ${losingTrades}L` },
    { label: 'Cash Available', value: formatINR(balance + cryptoBalance), icon: DollarSign, positive: true, sub: `Stock: ${formatINR(balance)}` },
  ];

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'stocks' as const, label: `Stocks (${positions.length})` },
    { id: 'crypto' as const, label: `Crypto (${cryptoPositions.length})` },
    { id: 'trades' as const, label: `All Trades (${totalTrades})` },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar />

      <div className="flex items-center justify-between px-5 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${activeTab === tab.id ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <span className="text-[10px] text-muted-foreground font-mono">Updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>
        </div>
      </div>

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
              <div className={`font-mono text-base font-bold ${card.positive ? 'text-gain' : 'text-loss'}`}>{card.value}</div>
              <div className="text-[10px] text-muted-foreground">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {(activeTab === 'overview' || activeTab === 'stocks') && positions.length > 0 && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-panel-header border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Stock Holdings</h2>
              <span className="text-[11px] text-muted-foreground">{positions.length} stocks · Invested {formatINR(stockInvested)}</span>
            </div>
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
                  {positions.map(pos => {
                    const wItem = watchlist.find(w => w.symbol === pos.symbol);
                    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
                    const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                    return (
                      <tr key={pos.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-foreground">{pos.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">{wItem?.name || pos.symbol}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{pos.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(pos.entryPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(pos.currentPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(pos.entryPrice * pos.quantity)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(pos.currentPrice * pos.quantity)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {pnl >= 0 ? '+' : ''}{formatINR(Math.abs(pnl))}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5 text-foreground">Total Stocks</td>
                    <td colSpan={3} className="px-4 py-2.5"></td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatINR(stockInvested)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatINR(stockCurrent)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${stockUnrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {stockUnrealizedPnl >= 0 ? '+' : ''}{formatINR(Math.abs(stockUnrealizedPnl))}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${stockUnrealizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {stockInvested > 0 ? `${((stockUnrealizedPnl / stockInvested) * 100).toFixed(2)}%` : '0.00%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'overview' || activeTab === 'crypto') && cryptoPositions.length > 0 && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-panel-header border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Bitcoin className="w-4 h-4" /> Crypto Holdings</h2>
              <span className="text-[11px] text-muted-foreground">{cryptoPositions.length} positions · Invested {formatINR(cryptoInvested)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium">Pair</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Entry (₹)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current (₹)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Invested</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current Val</th>
                    <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                    <th className="px-4 py-2.5 text-right font-medium">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {cryptoPositions.map(pos => {
                    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
                    const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                    return (
                      <tr key={pos.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground">{pos.pair}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{pos.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(pos.entryPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(pos.currentPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatINR(pos.entryPrice * pos.quantity)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">{formatINR(pos.currentPrice * pos.quantity)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {pnl >= 0 ? '+' : ''}{formatINR(Math.abs(pnl))}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'overview' || activeTab === 'trades') && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-panel-header border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Trade History</h2>
              <span className="text-[11px] text-muted-foreground">{allTrades.length} total · Realized P&L: {formatINR(stockRealizedPnl + cryptoRealizedPnl)}</span>
            </div>
            {allTrades.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No trades executed yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium">Time</th>
                    <th className="px-4 py-2.5 text-left font-medium">Market</th>
                    <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
                    <th className="px-4 py-2.5 text-left font-medium">Side</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {allTrades.slice(0, 50).map(t => (
                    <tr key={t.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {new Date(t.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.market === 'crypto' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
                          {t.market === 'crypto' ? 'CRYPTO' : 'STOCK'}
                        </span>
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
                      <td className={`px-4 py-2 text-right font-mono font-medium ${(t.pnl ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {t.pnl !== undefined ? `${t.pnl >= 0 ? '+' : ''}${formatINR(Math.abs(t.pnl))}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'overview' && positions.length === 0 && cryptoPositions.length === 0 && (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <PieChart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No holdings yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Buy stocks or crypto to see your portfolio here</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link to="/" className="text-xs text-primary hover:underline">Trade Stocks →</Link>
              <Link to="/crypto" className="text-xs text-warning hover:underline">Trade Crypto →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
