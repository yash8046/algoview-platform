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
  yahooSymbol: string;
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
  updatePrice: (symbol: string, price: number, prevClose: number) => void;
}

const initialWatchlist: WatchlistItem[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'RELIANCE.NS' },
  { symbol: 'TCS', name: 'Tata Consultancy', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'TCS.NS' },
  { symbol: 'INFY', name: 'Infosys Ltd.', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'INFY.NS' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'HDFCBANK.NS' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'ICICIBANK.NS' },
  { symbol: 'SBIN', name: 'State Bank of India', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'SBIN.NS' },
  { symbol: 'LT', name: 'Larsen & Toubro', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'LT.NS' },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'WIPRO.NS' },
  { symbol: 'ITC', name: 'ITC Ltd.', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'ITC.NS' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', price: 0, change: 0, changePercent: 0, volume: '—', type: 'stock', yahooSymbol: 'BAJFINANCE.NS' },
];

const initialSignals: AISignal[] = [
  { id: '1', symbol: 'RELIANCE', signal: 'buy', confidence: 0.87, model: 'LSTM', reason: 'Bullish divergence on RSI with EMA crossover at ₹1,280 support', timestamp: Date.now() - 300000 },
  { id: '2', symbol: 'TCS', signal: 'hold', confidence: 0.65, model: 'XGBoost', reason: 'Consolidation phase near ₹4,100, wait for breakout above resistance', timestamp: Date.now() - 600000 },
  { id: '3', symbol: 'TATAMOTORS', signal: 'sell', confidence: 0.78, model: 'RL Agent', reason: 'Overbought RSI > 75, strong resistance at ₹750 level', timestamp: Date.now() - 120000 },
  { id: '4', symbol: 'INFY', signal: 'buy', confidence: 0.92, model: 'LSTM', reason: 'Strong support bounce at ₹1,500 with volume confirmation', timestamp: Date.now() - 60000 },
  { id: '5', symbol: 'HDFCBANK', signal: 'buy', confidence: 0.81, model: 'XGBoost', reason: 'Positive banking sector momentum, breakout above 200 DMA', timestamp: Date.now() - 900000 },
];

export const useTradingStore = create<TradingState>((set, get) => ({
  balance: 1000000,
  initialBalance: 1000000,
  positions: [],
  trades: [],
  selectedSymbol: 'RELIANCE',
  selectedTimeframe: '1D',
  watchlist: initialWatchlist,
  aiSignals: initialSignals,

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  updatePrice: (symbol, price, prevClose) => {
    set((state) => ({
      watchlist: state.watchlist.map(item =>
        item.symbol === symbol
          ? {
              ...item,
              price,
              change: price - prevClose,
              changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
            }
          : item
      ),
      positions: state.positions.map(pos =>
        pos.symbol === symbol ? { ...pos, currentPrice: price } : pos
      ),
    }));
  },

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
}));
