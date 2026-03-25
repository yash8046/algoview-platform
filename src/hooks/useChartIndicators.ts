import { useState, useCallback } from 'react';
import type { IndicatorConfig } from '@/components/ChartIndicatorOverlay';

export function useChartIndicators() {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);

  const toggleIndicator = useCallback((type: IndicatorConfig['type'], period?: number) => {
    setIndicators(prev => {
      const exists = prev.find(i => i.type === type);
      if (exists) return prev.filter(i => i.type !== type);
      const colors: Record<string, string> = {
        sma: '#26c6da', ema: '#f59e0b', rsi: '#8b5cf6',
        macd: '#22c55e', bollinger: '#3b82f6', vwap: '#ef4444',
      };
      return [...prev, {
        id: `${type}_${Date.now()}`,
        type,
        period,
        color: colors[type] || '#ffffff',
        enabled: true,
      }];
    });
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setIndicators(prev => prev.filter(i => i.id !== id));
  }, []);

  return { indicators, toggleIndicator, removeIndicator };
}
