import { Activity, Zap, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function TopBar() {
  const location = useLocation();

  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/20">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">AlgoTrade</span>
        </div>
        <nav className="flex items-center gap-1 ml-2">
          <Link
            to="/"
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${location.pathname === '/' ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            Trade
          </Link>
          <Link
            to="/portfolio"
            className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${location.pathname === '/portfolio' ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            <BarChart3 className="w-3 h-3" />
            Portfolio
          </Link>
        </nav>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
          PAPER TRADING
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium border border-warning/20">
          NSE · INR
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[11px] text-gain">
          <Activity className="w-3.5 h-3.5" />
          <span className="font-mono">Live Data</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleTimeString('en-IN')}
        </span>
      </div>
    </header>
  );
}
