let cachedRate: number | null = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute for live feel

const RATE_APIS = [
  {
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=USDTINR',
    parse: (data: any) => parseFloat(data.price),
  },
  {
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr',
    parse: (data: any) => data?.tether?.inr,
  },
];

export async function getUsdToInrRate(): Promise<number> {
  if (cachedRate && Date.now() - lastFetch < CACHE_TTL) return cachedRate;

  for (const api of RATE_APIS) {
    try {
      const res = await fetch(api.url);
      if (res.ok) {
        const data = await res.json();
        const rate = api.parse(data);
        if (rate && rate > 50 && rate < 200) {
          cachedRate = rate;
          lastFetch = Date.now();
          return cachedRate;
        }
      }
    } catch {}
  }

  // Fallback
  cachedRate = cachedRate || 84.5;
  lastFetch = Date.now();
  return cachedRate;
}

// Auto-refresh rate every 60s
let refreshInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(rate: number) => void>();

export function subscribeToRate(cb: (rate: number) => void): () => void {
  listeners.add(cb);
  if (!refreshInterval) {
    refreshInterval = setInterval(async () => {
      const rate = await getUsdToInrRate();
      listeners.forEach(fn => fn(rate));
    }, 60000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };
}

export function formatINR(val: number): string {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
