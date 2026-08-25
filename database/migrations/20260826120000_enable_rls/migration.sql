-- Enable Row Level Security on all public tables.
-- Backend connects as table owner (postgres superuser) and bypasses RLS.
-- This blocks anonymous access via Supabase REST API (default deny).
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END;
$$;
