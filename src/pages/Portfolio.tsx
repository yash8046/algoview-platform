import { useTradingStore } from '@/stores/tradingStore';
import { useCryptoStore } from '@/stores/cryptoStore';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { fetchYahooFinanceData } from '@/lib/yahooFinance';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Bitcoin, LineChart,
  FlaskConical, RefreshCw, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  Wallet, Target, Trophy, Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import TopBar from '@/components/TopBar';

function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(val: number) {
  const abs = Math.abs(val);
  if (abs >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return formatINR(val);
}

// Simple card for key metrics
function StatCard({ icon: Icon, label, value, subtitle, positive, helpText }: {
  icon: any; label: string; value: string; subtitle?: string; positive?: boolean; helpText?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${positive === undefined ? 'bg-primary/10' : positive ? 'bg-gain/10' : 'bg-loss/10'}`}>
            <Icon className={`w-4 h-4 ${positive === undefined ? 'text-primary' : positive ? 'text-gain' : 'text-loss'}`} />
          </div>
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
      </div>
      <div className={`font-mono text-lg font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-gain' : 'text-loss'}`}>
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      {helpText && <div className="text-[10px] text-muted-foreground/70 italic">{helpText}</div>}
    </div>
  );
}

// Collapsible section
function Section({ title, icon: Icon, children, defaultOpen = true, count }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-panel-header border-b border-border active:bg-accent/50 min-h-[48px]">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-mono">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && children}
    </div>
  );
}

// Simple position row for mobile
function PositionRow({ symbol, name, qty, entry, current, pnl, pnlPct }: {
  symbol: string; name?: string; qty: number; entry: number; current: number; pnl: number; pnlPct: number;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-semibold text-foreground">{symbol}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {qty} × {formatINR(entry)} → {formatINR(current)}
        </div>
      </div>
      <div className="text-right ml-3">
        <div className={`font-mono text-sm font-semibold flex items-center justify-end gap-1 ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
          {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {pnl >= 0 ? '+' : ''}{formatCompact(pnl)}
        </div>
        <div className={`text-[10px] font-mono ${pnlPct >= 0 ? 'text-gain' : 'text-loss'}`}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const { user } = useAuth();
  const { balance, initialBalance, positions, trades, watchlist, updatePrice, loadFromDB: loadStockDB } = useTradingStore();
  const { balance: cryptoBalance, initialBalance: cryptoInitBal, positions: cryptoPositions, trades: cryptoTrades, loadFromDB: loadCryptoDB } = useCryptoStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

  // Calculations
  const stockInvested = positions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const stockCurrent = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const stockPnl = stockCurrent - stockInvested;

  const cryptoInvested = cryptoPositions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const cryptoCurrent = cryptoPositions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const cryptoPnl = cryptoCurrent - cryptoInvested;

  const realizedPnl = [...trades, ...cryptoTrades].reduce((s, t) => s + (t.pnl || 0), 0);
  const totalPortfolio = balance + stockCurrent + cryptoBalance + cryptoCurrent;
  const totalInitial = initialBalance + cryptoInitBal;
  const totalPnl = stockPnl + cryptoPnl + realizedPnl;
  const totalReturn = ((totalPortfolio - totalInitial) / totalInitial) * 100;

  const totalTrades = trades.length + cryptoTrades.length;
  const winTrades = [...trades, ...cryptoTrades].filter(t => (t.pnl ?? 0) > 0).length;
  const loseTrades = [...trades, ...cryptoTrades].filter(t => (t.pnl ?? 0) < 0).length;
  const winRate = totalTrades > 0 ? ((winTrades / (winTrades + loseTrades || 1)) * 100) : 0;

  const recentTrades = [...trades.map(t => ({ ...t, market: 'Stock' })), ...cryptoTrades.map(t => ({ ...t, symbol: t.pair, market: 'Crypto' }))]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const hasHoldings = positions.length > 0 || cryptoPositions.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar />

      {/* Sim banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-warning/5 border-b border-warning/15">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-warning" />
          <span className="text-[11px] text-warning font-medium">Simulation Mode · Virtual Money Only</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground active:scale-95 min-h-[36px] px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-3">
        {/* Key metrics - 2x2 grid, mobile-friendly */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Wallet} label="Total Portfolio" positive={totalPortfolio >= totalInitial}
            value={formatCompact(totalPortfolio)}
            subtitle={`Started with ${formatCompact(totalInitial)}`}
            helpText="Your total virtual holdings + cash"
          />
          <StatCard
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown} label="Total P&L" positive={totalPnl >= 0}
            value={`${totalPnl >= 0 ? '+' : ''}${formatCompact(totalPnl)}`}
            subtitle={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}% return`}
            helpText="Profit or loss across all trades"
          />
          <StatCard
            icon={Trophy} label="Win Rate" positive={winRate >= 50}
            value={totalTrades > 0 ? `${winRate.toFixed(0)}%` : '—'}
            subtitle={`${winTrades}W / ${loseTrades}L of ${totalTrades} trades`}
            helpText="How often your trades are profitable"
          />
          <StatCard
            icon={DollarSign} label="Cash Available" positive={true}
            value={formatCompact(balance + cryptoBalance)}
            subtitle={`Stock: ${formatCompact(balance)} · Crypto: ${formatCompact(cryptoBalance)}`}
            helpText="Virtual cash ready to invest"
          />
        </div>

        {/* Stock holdings */}
        {positions.length > 0 && (
          <Section title="Stock Holdings" icon={BarChart3} count={positions.length}>
            {positions.map(pos => {
              const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
              const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
              const wItem = watchlist.find(w => w.symbol === pos.symbol);
              return (
                <PositionRow key={pos.id} symbol={pos.symbol} name={wItem?.name}
                  qty={pos.quantity} entry={pos.entryPrice} current={pos.currentPrice}
                  pnl={pnl} pnlPct={pnlPct} />
              );
            })}
            <div className="px-4 py-2 bg-muted/20 flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Invested: {formatCompact(stockInvested)}</span>
              <span className={stockPnl >= 0 ? 'text-gain' : 'text-loss'}>
                P&L: {stockPnl >= 0 ? '+' : ''}{formatCompact(stockPnl)}
              </span>
            </div>
          </Section>
        )}

        {/* Crypto holdings */}
        {cryptoPositions.length > 0 && (
          <Section title="Crypto Holdings" icon={Bitcoin} count={cryptoPositions.length}>
            {cryptoPositions.map(pos => {
              const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
              const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
              return (
                <PositionRow key={pos.id} symbol={pos.pair}
                  qty={pos.quantity} entry={pos.entryPrice} current={pos.currentPrice}
                  pnl={pnl} pnlPct={pnlPct} />
              );
            })}
            <div className="px-4 py-2 bg-muted/20 flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Invested: {formatCompact(cryptoInvested)}</span>
              <span className={cryptoPnl >= 0 ? 'text-gain' : 'text-loss'}>
                P&L: {cryptoPnl >= 0 ? '+' : ''}{formatCompact(cryptoPnl)}
              </span>
            </div>
          </Section>
        )}

        {/* Recent trades */}
        {recentTrades.length > 0 && (
          <Section title="Recent Trades" icon={Activity} defaultOpen={false} count={totalTrades}>
            {recentTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{t.symbol}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${t.side === 'buy' ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'}`}>
                      {t.side === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground">{t.market}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(t.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-foreground">{formatINR(t.total)}</div>
                  {t.pnl !== undefined && t.pnl !== null && (
                    <div className={`text-[10px] font-mono ${t.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {t.pnl >= 0 ? '+' : ''}{formatINR(Math.abs(t.pnl))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Empty state */}
        {!hasHoldings && recentTrades.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
            <Target className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Start Your Trading Journey</p>
              <p className="text-xs text-muted-foreground mt-1">
                Practice trading with ₹10,00,000 virtual cash — no real money involved!
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link to="/" className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium active:scale-95">
                Trade Stocks →
              </Link>
              <Link to="/crypto" className="px-4 py-2 text-xs bg-warning/15 text-warning rounded-lg font-medium active:scale-95">
                Trade Crypto →
              </Link>
            </div>
          </div>
        )}

        {/* Last updated */}
        <div className="text-center text-[10px] text-muted-foreground font-mono pt-1">
          Last updated: {lastUpdated.toLocaleTimeString('en-IN')}
        </div>
      </div>
    </div>
  );
}
