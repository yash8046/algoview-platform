import { create } from 'zustand';

export interface CryptoPosition {
  id: string;
  pair: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  timestamp: number;
}

export interface CryptoTrade {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  timestamp: number;
  pnl?: number;
}

export interface CryptoPair {
  symbol: string;
  label: string;
  baseAsset: string;
  quoteAsset: string;
}

export const CRYPTO_PAIRS: CryptoPair[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
  { symbol: 'ADAUSDT', label: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USDT', baseAsset: 'AVAX', quoteAsset: 'USDT' },
];

interface CryptoState {
  balance: number;
  initialBalance: number;
  selectedPair: string;
  selectedInterval: string;
  positions: CryptoPosition[];
  trades: CryptoTrade[];
  setSelectedPair: (pair: string) => void;
  setSelectedInterval: (interval: string) => void;
  executeTrade: (pair: string, side: 'buy' | 'sell', price: number, quantity: number) => void;
  closePosition: (id: string) => void;
  updatePositionPrice: (pair: string, price: number) => void;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  balance: 10000,
  initialBalance: 10000,
  selectedPair: 'BTCUSDT',
  selectedInterval: '1m',
  positions: [],
  trades: [],

  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSelectedInterval: (interval) => set({ selectedInterval: interval }),

  updatePositionPrice: (pair, price) =>
    set((s) => ({
      positions: s.positions.map((p) =>
        p.pair === pair ? { ...p, currentPrice: price } : p
      ),
    })),

  executeTrade: (pair, side, price, quantity) => {
    const total = price * quantity;
    const state = get();
    if (side === 'buy' && total > state.balance) return;

    const trade: CryptoTrade = {
      id: crypto.randomUUID(),
      pair, side, price, quantity, total,
      timestamp: Date.now(),
    };

    if (side === 'buy') {
      const pos: CryptoPosition = {
        id: crypto.randomUUID(),
        pair, side: 'long', entryPrice: price, quantity, currentPrice: price,
        timestamp: Date.now(),
      };
      set({
        balance: state.balance - total,
        positions: [...state.positions, pos],
        trades: [trade, ...state.trades],
      });
    } else {
      const pos = state.positions.find((p) => p.pair === pair);
      if (pos) {
        const pnl = (price - pos.entryPrice) * pos.quantity;
        trade.pnl = pnl;
        set({
          balance: state.balance + total,
          positions: state.positions.filter((p) => p.id !== pos.id),
          trades: [trade, ...state.trades],
        });
      }
    }
  },

  closePosition: (id) => {
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;
    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
    const trade: CryptoTrade = {
      id: crypto.randomUUID(),
      pair: pos.pair, side: 'sell',
      price: pos.currentPrice, quantity: pos.quantity,
      total: pos.currentPrice * pos.quantity,
      timestamp: Date.now(), pnl,
    };
    set({
      balance: state.balance + trade.total,
      positions: state.positions.filter((p) => p.id !== id),
      trades: [trade, ...state.trades],
    });
  },
}));
