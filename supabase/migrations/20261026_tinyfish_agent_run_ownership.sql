-- Store TinyFish Agent run ownership so one manager cannot inspect another account's research runs.
CREATE TABLE IF NOT EXISTS public.tinyfish_agent_runs (
  run_id text PRIMARY KEY CHECK (run_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  owner_role text NOT NULL CHECK (owner_role IN ('manager', 'hr', 'admin')),
  target_url text NOT NULL CHECK (target_url ~* '^https?://'),
  goal text NOT NULL CHECK (length(btrim(goal)) BETWEEN 20 AND 1500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tinyfish_agent_runs_owner_created_idx
  ON public.tinyfish_agent_runs (owner_auth_user_id, created_at DESC);
ALTER TABLE public.tinyfish_agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can create their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can create their TinyFish runs"
  ON public.tinyfish_agent_runs FOR INSERT TO authenticated
  WITH CHECK (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = public.current_employee_id()
    AND owner_role = public.current_system_role()
    AND public.is_reviewer_or_admin()
  );
DROP POLICY IF EXISTS "Owners can view their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can view their TinyFish runs"
  ON public.tinyfish_agent_runs FOR SELECT TO authenticated
  USING (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = public.current_employee_id()
    AND public.is_reviewer_or_admin()
  );
GRANT SELECT, INSERT ON public.tinyfish_agent_runs TO authenticated;
REVOKE ALL ON public.tinyfish_agent_runs FROM anon;
REVOKE UPDATE, DELETE ON public.tinyfish_agent_runs FROM authenticated;
COMMENT ON TABLE public.tinyfish_agent_runs IS 'Owner-scoped registry for metered TinyFish Agent runs. Run results can only be polled by the originating active manager/HR/admin account.';
