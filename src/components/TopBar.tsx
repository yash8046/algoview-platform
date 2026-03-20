import { Activity, Zap } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/20">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">AlgoTrade</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
          PAPER TRADING
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[11px] text-gain">
          <Activity className="w-3.5 h-3.5" />
          <span className="font-mono">Market Open</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </header>
  );
}
