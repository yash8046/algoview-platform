
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.portfolio_balance (market, balance, initial_balance, currency, user_id)
  VALUES 
    ('stock', 1000000, 1000000, 'INR', NEW.id),
    ('crypto', 1000000, 1000000, 'INR', NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to trading tables
ALTER TABLE public.paper_trades ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.paper_positions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_balance ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old policies
DROP POLICY IF EXISTS "Public read trades" ON public.paper_trades;
DROP POLICY IF EXISTS "Public insert trades" ON public.paper_trades;
DROP POLICY IF EXISTS "Public read positions" ON public.paper_positions;
DROP POLICY IF EXISTS "Public insert positions" ON public.paper_positions;
DROP POLICY IF EXISTS "Public update positions" ON public.paper_positions;
DROP POLICY IF EXISTS "Public delete positions" ON public.paper_positions;
DROP POLICY IF EXISTS "Public read balance" ON public.portfolio_balance;
DROP POLICY IF EXISTS "Public update balance" ON public.portfolio_balance;

-- New user-scoped policies
CREATE POLICY "Users read own trades" ON public.paper_trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trades" ON public.paper_trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own positions" ON public.paper_positions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own positions" ON public.paper_positions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own positions" ON public.paper_positions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own positions" ON public.paper_positions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users read own balance" ON public.portfolio_balance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own balance" ON public.portfolio_balance FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Drop the unique constraint on market since now multiple users can have same market
ALTER TABLE public.portfolio_balance DROP CONSTRAINT IF EXISTS portfolio_balance_market_key;
ALTER TABLE public.portfolio_balance ADD CONSTRAINT portfolio_balance_user_market_unique UNIQUE (user_id, market);
