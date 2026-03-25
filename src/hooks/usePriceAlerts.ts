import { useState, useEffect, useCallback, useRef } from 'react';

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: number;
  message?: string;
}

const STORAGE_KEY = 'price_alerts';

function loadAlerts(): PriceAlert[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const lastChecked = useRef<Record<string, number>>({});

  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  const addAlert = useCallback((symbol: string, price: number, condition: 'above' | 'below', message?: string) => {
    const alert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      symbol, price, condition, triggered: false,
      createdAt: Date.now(), message,
    };
    setAlerts(prev => [...prev, alert]);
    return alert;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.triggered));
  }, []);

  const checkAlerts = useCallback((symbol: string, currentPrice: number) => {
    const now = Date.now();
    // Throttle: check at most every 2 seconds per symbol
    if (lastChecked.current[symbol] && now - lastChecked.current[symbol] < 2000) return;
    lastChecked.current[symbol] = now;

    setAlerts(prev => {
      let changed = false;
      const updated = prev.map(alert => {
        if (alert.triggered || alert.symbol !== symbol) return alert;
        const triggered =
          (alert.condition === 'above' && currentPrice >= alert.price) ||
          (alert.condition === 'below' && currentPrice <= alert.price);
        if (triggered) {
          changed = true;
          // Browser notification
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Price Alert: ${symbol}`, {
                body: `${symbol} is now ${alert.condition === 'above' ? 'above' : 'below'} ${alert.price.toFixed(2)} (Current: ${currentPrice.toFixed(2)})`,
                icon: '/favicon.ico',
              });
            }
          } catch {}
          return { ...alert, triggered: true };
        }
        return alert;
      });
      return changed ? updated : prev;
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return {
    alerts,
    addAlert,
    removeAlert,
    clearTriggered,
    checkAlerts,
    requestNotificationPermission,
    activeAlerts: alerts.filter(a => !a.triggered),
    triggeredAlerts: alerts.filter(a => a.triggered),
  };
}
