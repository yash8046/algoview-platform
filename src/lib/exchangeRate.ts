import { supabase } from '@/integrations/supabase/client';

let cachedRate: number | null = null;
let lastFetch = 0;

export async function getUsdToInrRate(): Promise<number> {
  // Cache for 5 minutes
  if (cachedRate && Date.now() - lastFetch < 300000) return cachedRate;

  try {
    // Use Binance USDTINR or fallback
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTINR');
    if (res.ok) {
      const data = await res.json();
      cachedRate = parseFloat(data.price);
      lastFetch = Date.now();
      return cachedRate;
    }
  } catch {}

  // Fallback rate
  cachedRate = 84.5;
  lastFetch = Date.now();
  return cachedRate;
}

export function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
