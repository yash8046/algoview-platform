CREATE TABLE public.ai_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  pair text NOT NULL,
  timeframe text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_ai_insights_cache_key ON public.ai_insights_cache(cache_key);
CREATE INDEX idx_ai_insights_cache_expires ON public.ai_insights_cache(expires_at);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ai insights cache"
ON public.ai_insights_cache
FOR SELECT
TO anon, authenticated
USING (expires_at > now());

CREATE POLICY "Public insert ai insights cache"
ON public.ai_insights_cache
FOR INSERT
TO anon, authenticated
WITH CHECK (true);