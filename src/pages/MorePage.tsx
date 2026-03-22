import { Link } from 'react-router-dom';
import { Shield, FileText, Scale, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import TopBar from '@/components/TopBar';

const cards = [
  {
    to: '/disclaimer',
    icon: AlertTriangle,
    title: 'Disclaimer',
    description: 'Important information about AI-generated insights and risk',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  {
    to: '/privacy',
    icon: Shield,
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  {
    to: '/terms',
    icon: Scale,
    title: 'Terms of Service',
    description: 'Rules and conditions for using MarketLens',
    color: 'text-gain',
    bgColor: 'bg-gain/10',
    borderColor: 'border-gain/20',
  },
];

export default function MorePage() {
  return (
    <div className="flex h-[100svh] max-h-[100svh] flex-col overflow-hidden overscroll-none">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-3 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:p-4">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">More</h1>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-between gap-6">
          <div className="flex flex-col gap-2.5">
            {cards.map(card => (
              <Link
                key={card.to}
                to={card.to}
                className={`flex items-center gap-3 p-3.5 rounded-lg border ${card.borderColor} ${card.bgColor} hover:opacity-90 active:scale-[0.99] transition-all`}
              >
                <div className={`p-2 rounded-lg bg-card border border-border`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{card.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>

          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 font-mono">MarketLens v1.0 • AI Market Analysis Tool</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">For educational & research purposes only</p>
          </div>
        </div>
      </div>
    </div>
  );
}
