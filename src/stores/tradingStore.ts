import { create } from 'zustand';

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  timestamp: number;
  pnl?: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  type: 'stock' | 'crypto';
}

export interface AISignal {
  id: string;
  symbol: string;
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  model: string;
  reason: string;
  timestamp: number;
}

interface TradingState {
  balance: number;
  initialBalance: number;
  positions: Position[];
  trades: Trade[];
  selectedSymbol: string;
  selectedTimeframe: string;
  watchlist: WatchlistItem[];
  aiSignals: AISignal[];
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (tf: string) => void;
  executeTrade: (symbol: string, side: 'buy' | 'sell', price: number, quantity: number) => void;
  closePosition: (positionId: string) => void;
  updateWatchlistPrices: () => void;
}

const initialWatchlist: WatchlistItem[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.84, change: 2.34, changePercent: 1.25, volume: '54.2M', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', price: 378.91, change: -1.23, changePercent: -0.32, volume: '22.1M', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet', price: 141.80, change: 0.95, changePercent: 0.67, volume: '18.7M', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.42, change: 5.67, changePercent: 2.34, volume: '98.3M', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', price: 495.22, change: 12.44, changePercent: 2.58, volume: '45.8M', type: 'stock' },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: 67432.50, change: 1234.00, changePercent: 1.87, volume: '32.1B', type: 'crypto' },
  { symbol: 'ETH/USD', name: 'Ethereum', price: 3521.80, change: -45.20, changePercent: -1.27, volume: '14.8B', type: 'crypto' },
  { symbol: 'SOL/USD', name: 'Solana', price: 148.63, change: 8.92, changePercent: 6.38, volume: '4.2B', type: 'crypto' },
];

const initialSignals: AISignal[] = [
  { id: '1', symbol: 'AAPL', signal: 'buy', confidence: 0.87, model: 'LSTM', reason: 'Bullish divergence on RSI with EMA crossover', timestamp: Date.now() - 300000 },
  { id: '2', symbol: 'BTC/USD', signal: 'hold', confidence: 0.65, model: 'XGBoost', reason: 'Consolidation phase, wait for breakout', timestamp: Date.now() - 600000 },
  { id: '3', symbol: 'TSLA', signal: 'sell', confidence: 0.78, model: 'RL Agent', reason: 'Overbought RSI > 75, resistance at $255', timestamp: Date.now() - 120000 },
  { id: '4', symbol: 'ETH/USD', signal: 'buy', confidence: 0.92, model: 'LSTM', reason: 'Strong support bounce at $3,450 level', timestamp: Date.now() - 60000 },
  { id: '5', symbol: 'NVDA', signal: 'buy', confidence: 0.81, model: 'XGBoost', reason: 'Positive earnings momentum, sector rotation', timestamp: Date.now() - 900000 },
];

export const useTradingStore = create<TradingState>((set, get) => ({
  balance: 10000,
  initialBalance: 10000,
  positions: [],
  trades: [],
  selectedSymbol: 'AAPL',
  selectedTimeframe: '1D',
  watchlist: initialWatchlist,
  aiSignals: initialSignals,

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  executeTrade: (symbol, side, price, quantity) => {
    const total = price * quantity;
    const state = get();

    if (side === 'buy' && total > state.balance) return;

    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol,
      side,
      price,
      quantity,
      total,
      timestamp: Date.now(),
    };

    if (side === 'buy') {
      const position: Position = {
        id: crypto.randomUUID(),
        symbol,
        side: 'long',
        entryPrice: price,
        quantity,
        currentPrice: price,
        timestamp: Date.now(),
      };
      set({
        balance: state.balance - total,
        positions: [...state.positions, position],
        trades: [trade, ...state.trades],
      });
    } else {
      const pos = state.positions.find(p => p.symbol === symbol);
      if (pos) {
        const pnl = (price - pos.entryPrice) * pos.quantity;
        trade.pnl = pnl;
        set({
          balance: state.balance + total,
          positions: state.positions.filter(p => p.id !== pos.id),
          trades: [trade, ...state.trades],
        });
      }
    }
  },

  closePosition: (positionId) => {
    const state = get();
    const pos = state.positions.find(p => p.id === positionId);
    if (!pos) return;
    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: pos.symbol,
      side: 'sell',
      price: pos.currentPrice,
      quantity: pos.quantity,
      total: pos.currentPrice * pos.quantity,
      timestamp: Date.now(),
      pnl,
    };
    set({
      balance: state.balance + trade.total,
      positions: state.positions.filter(p => p.id !== positionId),
      trades: [trade, ...state.trades],
    });
  },

  updateWatchlistPrices: () => {
    set((state) => ({
      watchlist: state.watchlist.map(item => {
        const variance = item.price * 0.002;
        const delta = (Math.random() - 0.5) * variance;
        const newPrice = Math.max(0.01, item.price + delta);
        const newChange = item.change + delta;
        const newChangePercent = (newChange / (newPrice - newChange)) * 100;
        return { ...item, price: newPrice, change: newChange, changePercent: newChangePercent };
      }),
      positions: state.positions.map(pos => {
        const wItem = state.watchlist.find(w => w.symbol === pos.symbol);
        return wItem ? { ...pos, currentPrice: wItem.price } : pos;
      }),
    }));
  },
}));
