import { useState } from 'react';
import { Activity, Zap, BarChart3, Bitcoin, LogOut, FlaskConical, Menu, X, Info, Shield, FileText, MoreHorizontal, Blocks } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function TopBar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const mainNavLinks = [
    { to: '/', label: 'Analysis', icon: null },
    { to: '/crypto', label: 'Crypto', icon: Bitcoin },
    { to: '/portfolio', label: 'Portfolio', icon: BarChart3 },
    { to: '/backtest', label: 'Backtest', icon: FlaskConical },
    { to: '/strategy-builder', label: 'Strategy', icon: Blocks },
  ];

  const moreLinks = [
    { to: '/disclaimer', label: 'Disclaimer', icon: Info },
    { to: '/privacy', label: 'Privacy', icon: Shield },
    { to: '/terms', label: 'Terms', icon: FileText },
  ];

  const allNavLinks = [...mainNavLinks, ...moreLinks];

  const isMoreActive = moreLinks.some(link => link.to === location.pathname);

  return (
    <header className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-card border-b border-border relative">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="p-1 sm:p-1.5 rounded-md bg-primary/20">
            <Zap className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
          </div>
          <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">AlgoInsight</span>
        </div>

        {!isMobile && (
          <>
            <nav className="flex items-center gap-1 ml-2">
              {mainNavLinks.map(link => (
                <Link key={link.to} to={link.to}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${location.pathname === link.to ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                  {link.icon && <link.icon className="w-3 h-3" />}
                  {link.label}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 outline-none ${isMoreActive ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                    <MoreHorizontal className="w-3 h-3" />
                    More
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {moreLinks.map(link => (
                    <DropdownMenuItem key={link.to} asChild>
                      <Link to={link.to} className={`flex items-center gap-2 ${location.pathname === link.to ? 'text-primary font-semibold' : ''}`}>
                        <link.icon className="w-3.5 h-3.5" />
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium border border-warning/20">
              SIMULATION MODE
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isMobile && (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-gain">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-mono">Live Data</span>
            </div>
            {user && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">{user.email}</span>
            )}
          </>
        )}
        {isMobile ? (
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        ) : (
          <button onClick={signOut}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-loss transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {isMobile && menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-border z-50 p-3 space-y-1">
          {allNavLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
              className={`block text-sm px-3 py-2.5 rounded-md transition-colors ${location.pathname === link.to ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
              <span className="flex items-center gap-2">
                {link.icon && <link.icon className="w-4 h-4" />}
                {link.label}
              </span>
            </Link>
          ))}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            {user && <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>}
            <button onClick={signOut} className="flex items-center gap-1 text-xs text-loss">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}