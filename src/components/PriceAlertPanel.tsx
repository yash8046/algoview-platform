import { useState } from 'react';
import { Bell, BellRing, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { PriceAlert } from '@/hooks/usePriceAlerts';

interface Props {
  alerts: PriceAlert[];
  activeAlerts: PriceAlert[];
  triggeredAlerts: PriceAlert[];
  currentSymbol: string;
  currentPrice: number;
  onAdd: (symbol: string, price: number, condition: 'above' | 'below', message?: string) => void;
  onRemove: (id: string) => void;
  onClearTriggered: () => void;
  onRequestPermission: () => void;
}

export default function PriceAlertPanel({
  alerts, activeAlerts, triggeredAlerts,
  currentSymbol, currentPrice,
  onAdd, onRemove, onClearTriggered, onRequestPermission,
}: Props) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');

  const handleAdd = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;
    onAdd(currentSymbol, p, condition);
    onRequestPermission();
    setPrice('');
  };

  const hasTriggered = triggeredAlerts.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-[10px] sm:text-xs font-mono transition-colors min-h-[32px] active:scale-95 ${
          hasTriggered ? 'bg-warning/20 text-warning' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="Price Alerts"
      >
        {hasTriggered ? <BellRing className="w-3.5 h-3.5 animate-pulse" /> : <Bell className="w-3.5 h-3.5" />}
        {alerts.length > 0 && (
          <span className="bg-primary/20 text-primary text-[9px] px-1 rounded">{activeAlerts.length}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          className="fixed z-[9999] bg-card border border-border rounded-lg shadow-xl p-3 w-72"
          style={{ top: 80, right: 16 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Price Alerts</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add alert */}
          <div className="flex items-center gap-1.5 mb-3">
            <select
              value={condition}
              onChange={e => setCondition(e.target.value as 'above' | 'below')}
              className="bg-secondary text-foreground text-[10px] font-mono px-1.5 py-1.5 rounded border border-border min-h-[32px]"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={currentPrice.toFixed(2)}
              className="flex-1 bg-secondary text-foreground text-[11px] font-mono px-2 py-1.5 rounded border border-border min-h-[32px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleAdd}
              className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[9px] text-muted-foreground mb-2 font-mono">
            {currentSymbol} • Current: {currentPrice.toFixed(2)}
          </div>

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div className="space-y-1 mb-2">
              <div className="text-[10px] text-muted-foreground font-semibold">Active</div>
              {activeAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between px-2 py-1.5 bg-secondary/50 rounded text-[11px] font-mono">
                  <span className="flex items-center gap-1.5">
                    <Bell className="w-3 h-3 text-primary" />
                    <span className={alert.condition === 'above' ? 'text-gain' : 'text-loss'}>
                      {alert.condition === 'above' ? '↑' : '↓'} {alert.price.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-[9px]">{alert.symbol}</span>
                  </span>
                  <button onClick={() => onRemove(alert.id)} className="text-loss hover:bg-loss/10 rounded p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Triggered alerts */}
          {triggeredAlerts.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-warning font-semibold">Triggered</span>
                <button onClick={onClearTriggered} className="text-[9px] text-muted-foreground hover:text-foreground">
                  Clear all
                </button>
              </div>
              {triggeredAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between px-2 py-1.5 bg-warning/10 rounded text-[11px] font-mono">
                  <span className="flex items-center gap-1.5">
                    <BellRing className="w-3 h-3 text-warning" />
                    <span className="text-warning">
                      {alert.condition === 'above' ? '↑' : '↓'} {alert.price.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-[9px]">{alert.symbol}</span>
                  </span>
                  <button onClick={() => onRemove(alert.id)} className="text-loss hover:bg-loss/10 rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {alerts.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3">
              No alerts set. Add one above.
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
