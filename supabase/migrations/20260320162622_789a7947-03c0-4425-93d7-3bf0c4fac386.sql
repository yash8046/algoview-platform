
CREATE TABLE public.user_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own watchlist" ON public.user_watchlist
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own watchlist" ON public.user_watchlist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own watchlist" ON public.user_watchlist
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
