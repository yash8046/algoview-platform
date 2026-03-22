import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getUsdToInrRate, subscribeToRate } from '@/lib/exchangeRate';

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

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

interface CryptoState {
  balance: number;
  initialBalance: number;
  selectedPair: string;
  selectedInterval: string;
  positions: CryptoPosition[];
  trades: CryptoTrade[];
  usdToInr: number;
  setSelectedPair: (pair: string) => void;
  setSelectedInterval: (interval: string) => void;
  executeTrade: (pair: string, side: 'buy' | 'sell', price: number, quantity: number) => void;
  closePosition: (id: string) => void;
  updatePositionPrice: (pair: string, price: number) => void;
  loadExchangeRate: () => Promise<void>;
  loadFromDB: () => Promise<void>;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  balance: 1000000,
  initialBalance: 1000000,
  selectedPair: 'BTCUSDT',
  selectedInterval: '1m',
  positions: [],
  trades: [],
  usdToInr: 84.5,

  setSelectedPair: (pair) => set({ selectedPair: pair }),
  setSelectedInterval: (interval) => set({ selectedInterval: interval }),

  loadExchangeRate: async () => {
    const rate = await getUsdToInrRate();
    set({ usdToInr: rate });
    // Subscribe to live rate updates
    subscribeToRate((newRate) => set({ usdToInr: newRate }));
  },

  loadFromDB: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { data: balData } = await supabase
        .from('portfolio_balance')
        .select('*')
        .eq('market', 'crypto')
        .eq('user_id', userId)
        .single();
      if (balData) {
        set({ balance: Number(balData.balance), initialBalance: Number(balData.initial_balance) });
      }

      const { data: posData } = await supabase
        .from('paper_positions')
        .select('*')
        .eq('market', 'crypto')
        .eq('user_id', userId);
      if (posData) {
        set({
          positions: posData.map((p: any) => ({
            id: p.id,
            pair: p.symbol,
            side: p.side as 'long' | 'short',
            entryPrice: Number(p.entry_price),
            quantity: Number(p.quantity),
            currentPrice: Number(p.current_price),
            timestamp: new Date(p.created_at).getTime(),
          })),
        });
      }

      const { data: tradeData } = await supabase
        .from('paper_trades')
        .select('*')
        .eq('market', 'crypto')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (tradeData) {
        set({
          trades: tradeData.map((t: any) => ({
            id: t.id,
            pair: t.symbol,
            side: t.side as 'buy' | 'sell',
            price: Number(t.price),
            quantity: Number(t.quantity),
            total: Number(t.total),
            timestamp: new Date(t.created_at).getTime(),
            pnl: t.pnl ? Number(t.pnl) : undefined,
          })),
        });
      }
    } catch (e) {
      console.error('Failed to load crypto data from DB:', e);
    }
  },

  updatePositionPrice: (pair, price) => {
    const { usdToInr } = get();
    const inrPrice = price * usdToInr;
    set((s) => ({
      positions: s.positions.map((p) =>
        p.pair === pair ? { ...p, currentPrice: inrPrice } : p
      ),
    }));
  },

  executeTrade: async (pair, side, price, quantity) => {
    const userId = await getUserId();
    if (!userId) return;

    const state = get();
    const inrPrice = price * state.usdToInr;
    const total = inrPrice * quantity;
    if (side === 'buy' && total > state.balance) return;

    const trade: CryptoTrade = {
      id: crypto.randomUUID(),
      pair, side, price: inrPrice, quantity, total,
      timestamp: Date.now(),
    };

    if (side === 'buy') {
      const pos: CryptoPosition = {
        id: crypto.randomUUID(),
        pair, side: 'long', entryPrice: inrPrice, quantity, currentPrice: inrPrice,
        timestamp: Date.now(),
      };
      const newBalance = state.balance - total;
      set({
        balance: newBalance,
        positions: [...state.positions, pos],
        trades: [trade, ...state.trades],
      });

      await Promise.all([
        supabase.from('paper_trades').insert({ id: trade.id, symbol: pair, side, price: inrPrice, quantity, total, market: 'crypto', currency: 'INR', user_id: userId }),
        supabase.from('paper_positions').insert({ id: pos.id, symbol: pair, side: 'long', entry_price: inrPrice, quantity, current_price: inrPrice, market: 'crypto', currency: 'INR', user_id: userId }),
        supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'crypto').eq('user_id', userId),
      ]);
    } else {
      const pos = state.positions.find((p) => p.pair === pair);
      if (pos) {
        const pnl = (inrPrice - pos.entryPrice) * pos.quantity;
        trade.pnl = pnl;
        const newBalance = state.balance + total;
        set({
          balance: newBalance,
          positions: state.positions.filter((p) => p.id !== pos.id),
          trades: [trade, ...state.trades],
        });

        await Promise.all([
          supabase.from('paper_trades').insert({ id: trade.id, symbol: pair, side, price: inrPrice, quantity, total, pnl, market: 'crypto', currency: 'INR', user_id: userId }),
          supabase.from('paper_positions').delete().eq('id', pos.id),
          supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'crypto').eq('user_id', userId),
        ]);
      }
    }
  },

  closePosition: async (id) => {
    const userId = await getUserId();
    if (!userId) return;

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
    const newBalance = state.balance + trade.total;
    set({
      balance: newBalance,
      positions: state.positions.filter((p) => p.id !== id),
      trades: [trade, ...state.trades],
    });

    await Promise.all([
      supabase.from('paper_trades').insert({ id: trade.id, symbol: pos.pair, side: 'sell', price: pos.currentPrice, quantity: pos.quantity, total: trade.total, pnl, market: 'crypto', currency: 'INR', user_id: userId }),
      supabase.from('paper_positions').delete().eq('id', id),
      supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'crypto').eq('user_id', userId),
    ]);
  },
}));
