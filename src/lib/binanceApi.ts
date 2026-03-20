export interface BinanceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

export async function fetchKlines(
  symbol: string,
  interval: string = '1m',
  limit: number = 500
): Promise<BinanceCandle[]> {
  const url = `${BINANCE_REST}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json();

  return data.map((k: any[]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchTicker(symbol: string) {
  const res = await fetch(`${BINANCE_REST}/ticker/24hr?symbol=${symbol.toUpperCase()}`);
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  return res.json();
}

export interface WebSocketCallbacks {
  onCandle: (candle: BinanceCandle) => void;
  onError?: (err: Event) => void;
}

export function connectKlineWebSocket(
  symbol: string,
  interval: string,
  callbacks: WebSocketCallbacks
): () => void {
  const pair = symbol.toLowerCase();
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;
    ws = new WebSocket(`${BINANCE_WS}/${pair}@kline_${interval}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        if (!k) return;
        callbacks.onCandle({
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (err) => {
      callbacks.onError?.(err);
    };

    ws.onclose = () => {
      if (!destroyed) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
}
