
-- Watchlist items (master stock list)
CREATE TABLE public.watchlist_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  yahoo_symbol TEXT NOT NULL,
  stock_type TEXT NOT NULL DEFAULT 'stock',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paper trading trades (stocks + crypto)
CREATE TABLE public.paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  pnl NUMERIC,
  market TEXT NOT NULL DEFAULT 'stock' CHECK (market IN ('stock', 'crypto')),
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Open positions
CREATE TABLE public.paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'long',
  entry_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL DEFAULT 0,
  market TEXT NOT NULL DEFAULT 'stock' CHECK (market IN ('stock', 'crypto')),
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio balance
CREATE TABLE public.portfolio_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market TEXT NOT NULL UNIQUE CHECK (market IN ('stock', 'crypto')),
  balance NUMERIC NOT NULL DEFAULT 1000000,
  initial_balance NUMERIC NOT NULL DEFAULT 1000000,
  currency TEXT NOT NULL DEFAULT 'INR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default balances
INSERT INTO public.portfolio_balance (market, balance, initial_balance, currency) VALUES
  ('stock', 1000000, 1000000, 'INR'),
  ('crypto', 1000000, 1000000, 'INR');

-- Disable RLS since this is paper trading (no auth, public access)
ALTER TABLE public.watchlist_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_balance ENABLE ROW LEVEL SECURITY;

-- Public access policies (paper trading, no auth needed)
CREATE POLICY "Public read watchlist" ON public.watchlist_stocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read trades" ON public.paper_trades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert trades" ON public.paper_trades FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read positions" ON public.paper_positions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert positions" ON public.paper_positions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update positions" ON public.paper_positions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete positions" ON public.paper_positions FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Public read balance" ON public.portfolio_balance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public update balance" ON public.portfolio_balance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
