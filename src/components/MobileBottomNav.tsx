import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Bitcoin, FlaskConical, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const tabs = [
  { to: '/', label: 'Stocks', icon: BarChart3 },
  { to: '/crypto', label: 'Crypto', icon: Bitcoin },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/disclaimer', label: 'More', icon: Settings },
];

export default function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors active:scale-95 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
