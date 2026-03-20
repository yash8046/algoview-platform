import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

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



interface TradingState {
  balance: number;
  initialBalance: number;
  positions: Position[];
  trades: Trade[];
  selectedSymbol: string;
  selectedTimeframe: string;
  watchlist: WatchlistItem[];
  watchlistLoaded: boolean;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (tf: string) => void;
  executeTrade: (symbol: string, side: 'buy' | 'sell', price: number, quantity: number) => void;
  closePosition: (positionId: string) => void;
  updatePrice: (symbol: string, price: number, prevClose: number) => void;
  loadWatchlistFromDB: () => Promise<void>;
  loadUserWatchlist: () => Promise<void>;
  loadFromDB: () => Promise<void>;
}



async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  balance: 1000000,
  initialBalance: 1000000,
  positions: [],
  trades: [],
  selectedSymbol: 'NIFTY 50',
  selectedTimeframe: '1D',
  watchlist: [],
  watchlistLoaded: false,

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  loadWatchlistFromDB: async () => {
    try {
      const { data, error } = await supabase
        .from('watchlist_stocks')
        .select('*')
        .eq('is_active', true)
        .order('symbol');
      if (error) throw error;
      if (data) {
        const watchlist: WatchlistItem[] = data.map((d: any) => ({
          symbol: d.symbol,
          name: d.name,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: '—',
          type: d.stock_type as 'stock' | 'crypto',
          yahooSymbol: d.yahoo_symbol,
        }));
        set({ watchlist, watchlistLoaded: true });
      }
    } catch (e) {
      console.error('Failed to load watchlist from DB:', e);
    }
  },

  loadUserWatchlist: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      // Get user's personal watchlist symbols
      const { data: userItems, error: uwError } = await supabase
        .from('user_watchlist')
        .select('symbol')
        .eq('user_id', userId);
      if (uwError) throw uwError;

      if (!userItems || userItems.length === 0) {
        set({ watchlist: [], watchlistLoaded: true });
        return;
      }

      const symbols = userItems.map(u => u.symbol);

      // Get stock details from master list
      const { data: stocks, error: sError } = await supabase
        .from('watchlist_stocks')
        .select('*')
        .in('symbol', symbols)
        .eq('is_active', true);
      if (sError) throw sError;

      const watchlist: WatchlistItem[] = (stocks || []).map((d: any) => ({
        symbol: d.symbol,
        name: d.name,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: '—',
        type: d.stock_type as 'stock' | 'crypto',
        yahooSymbol: d.yahoo_symbol,
      }));
      set({ watchlist, watchlistLoaded: true });
    } catch (e) {
      console.error('Failed to load user watchlist:', e);
    }
  },

  loadFromDB: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { data: balData } = await supabase
        .from('portfolio_balance')
        .select('*')
        .eq('market', 'stock')
        .eq('user_id', userId)
        .single();
      if (balData) {
        set({ balance: Number(balData.balance), initialBalance: Number(balData.initial_balance) });
      }

      const { data: posData } = await supabase
        .from('paper_positions')
        .select('*')
        .eq('market', 'stock')
        .eq('user_id', userId);
      if (posData) {
        set({
          positions: posData.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
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
        .eq('market', 'stock')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (tradeData) {
        set({
          trades: tradeData.map((t: any) => ({
            id: t.id,
            symbol: t.symbol,
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
      console.error('Failed to load from DB:', e);
    }
  },

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

  executeTrade: async (symbol, side, price, quantity) => {
    const userId = await getUserId();
    if (!userId) return;

    const total = price * quantity;
    const state = get();

    if (side === 'buy' && total > state.balance) return;

    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol, side, price, quantity, total,
      timestamp: Date.now(),
    };

    if (side === 'buy') {
      const position: Position = {
        id: crypto.randomUUID(),
        symbol, side: 'long', entryPrice: price, quantity, currentPrice: price,
        timestamp: Date.now(),
      };
      const newBalance = state.balance - total;
      set({
        balance: newBalance,
        positions: [...state.positions, position],
        trades: [trade, ...state.trades],
      });

      await Promise.all([
        supabase.from('paper_trades').insert({ id: trade.id, symbol, side, price, quantity, total, market: 'stock', currency: 'INR', user_id: userId }),
        supabase.from('paper_positions').insert({ id: position.id, symbol, side: 'long', entry_price: price, quantity, current_price: price, market: 'stock', currency: 'INR', user_id: userId }),
        supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'stock').eq('user_id', userId),
      ]);
    } else {
      const pos = state.positions.find(p => p.symbol === symbol);
      if (pos) {
        const pnl = (price - pos.entryPrice) * pos.quantity;
        trade.pnl = pnl;
        const newBalance = state.balance + total;
        set({
          balance: newBalance,
          positions: state.positions.filter(p => p.id !== pos.id),
          trades: [trade, ...state.trades],
        });

        await Promise.all([
          supabase.from('paper_trades').insert({ id: trade.id, symbol, side, price, quantity, total, pnl, market: 'stock', currency: 'INR', user_id: userId }),
          supabase.from('paper_positions').delete().eq('id', pos.id),
          supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'stock').eq('user_id', userId),
        ]);
      }
    }
  },

  closePosition: async (positionId) => {
    const userId = await getUserId();
    if (!userId) return;

    const state = get();
    const pos = state.positions.find(p => p.id === positionId);
    if (!pos) return;
    const pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: pos.symbol, side: 'sell',
      price: pos.currentPrice, quantity: pos.quantity,
      total: pos.currentPrice * pos.quantity,
      timestamp: Date.now(), pnl,
    };
    const newBalance = state.balance + trade.total;
    set({
      balance: newBalance,
      positions: state.positions.filter(p => p.id !== positionId),
      trades: [trade, ...state.trades],
    });

    await Promise.all([
      supabase.from('paper_trades').insert({ id: trade.id, symbol: pos.symbol, side: 'sell', price: pos.currentPrice, quantity: pos.quantity, total: trade.total, pnl, market: 'stock', currency: 'INR', user_id: userId }),
      supabase.from('paper_positions').delete().eq('id', positionId),
      supabase.from('portfolio_balance').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('market', 'stock').eq('user_id', userId),
    ]);
  },
}));
