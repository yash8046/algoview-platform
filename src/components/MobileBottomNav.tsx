import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Bitcoin, CandlestickChart, FlaskConical, Blocks } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

const tabs = [
  { to: '/', label: 'Stocks', icon: BarChart3 },
  { to: '/crypto', label: 'Crypto', icon: Bitcoin },
  { to: '/charts', label: 'Charts', icon: CandlestickChart },
  { to: '/strategy-builder', label: 'Strategy', icon: Blocks },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
];

export default function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useAuth();

  const hiddenRoutes = ['/reset-password'];
  const isHidden = !user || hiddenRoutes.includes(location.pathname);

  if (!isMobile || isHidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = tab.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors active:scale-95 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-primary" />
              )}
              <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
