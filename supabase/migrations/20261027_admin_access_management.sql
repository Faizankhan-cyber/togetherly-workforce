-- Togetherly: allow active administrators to safely revoke another admin's privileges.
-- This demotes an account to Manager; it does not delete the account or employee history.

CREATE TABLE IF NOT EXISTS public.admin_access_audit_logs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  actor_auth_user_id uuid NOT NULL,
  actor_employee_id text NOT NULL,
  actor_name text NOT NULL,
  target_auth_user_id uuid NOT NULL,
  target_employee_id text NOT NULL,
  target_name text NOT NULL,
  target_email text NOT NULL,
  from_system_role text NOT NULL CHECK (from_system_role = 'admin'),
  to_system_role text NOT NULL CHECK (to_system_role = 'manager'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS admin_access_audit_logs_created_at_idx
  ON public.admin_access_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_audit_logs_target_idx
  ON public.admin_access_audit_logs (target_employee_id, created_at DESC);

ALTER TABLE public.admin_access_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active admins can view admin access audit" ON public.admin_access_audit_logs;
CREATE POLICY "Active admins can view admin access audit"
  ON public.admin_access_audit_logs
  FOR SELECT TO authenticated
  USING (public.current_system_role() = 'admin');
GRANT SELECT ON public.admin_access_audit_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_access_audit_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_active_admin_accounts()
RETURNS TABLE (
  employee_id text,
  auth_user_id uuid,
  full_name text,
  email text,
  department text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.current_system_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can list administrator accounts.';
  END IF;

  RETURN QUERY
    SELECT e.id, e.auth_user_id, e.name, e.email, e.department
    FROM public.employees AS e
    WHERE e.system_role = 'admin'
      AND e.employment_status = 'active'
      AND e.auth_user_id IS NOT NULL
    ORDER BY e.name, e.email;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_active_admin_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_active_admin_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_admin_access(p_employee_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_employee_id text;
  v_actor_name text;
  v_target_id text;
  v_target_auth_user_id uuid;
  v_target_name text;
  v_target_email text;
  v_target_system_role text;
  v_target_employment_status text;
  v_active_admin_count integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Serialise admin-removal operations, so concurrent requests cannot remove the final admin.
  PERFORM pg_catalog.pg_advisory_xact_lock(780281, 4271);

  SELECT e.id, e.name
    INTO v_actor_employee_id, v_actor_name
    FROM public.employees AS e
    WHERE e.auth_user_id = v_actor_id
      AND e.system_role = 'admin'
      AND e.employment_status = 'active'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can remove admin access.';
  END IF;

  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Validation error: select an administrator account.';
  END IF;

  SELECT e.id, e.auth_user_id, e.name, e.email, e.system_role, e.employment_status
    INTO v_target_id, v_target_auth_user_id, v_target_name, v_target_email, v_target_system_role, v_target_employment_status
    FROM public.employees AS e
    WHERE e.id = p_employee_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administrator account not found.';
  END IF;

  IF v_target_auth_user_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot remove your own administrator access.';
  END IF;

  IF v_target_system_role <> 'admin' OR v_target_employment_status <> 'active' OR v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'This account is not an active administrator.';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_active_admin_count
    FROM public.employees AS e
    WHERE e.system_role = 'admin'
      AND e.employment_status = 'active'
      AND e.auth_user_id IS NOT NULL;

  IF v_active_admin_count <= 1 THEN
    RAISE EXCEPTION 'The last active administrator cannot be removed.';
  END IF;

  UPDATE public.employees AS e
    SET system_role = 'manager', updated_at = pg_catalog.now()
    WHERE e.id = v_target_id
      AND e.system_role = 'admin'
      AND e.employment_status = 'active';

  INSERT INTO public.admin_access_audit_logs (
    actor_auth_user_id, actor_employee_id, actor_name,
    target_auth_user_id, target_employee_id, target_name, target_email,
    from_system_role, to_system_role
  ) VALUES (
    v_actor_id, v_actor_employee_id, v_actor_name,
    v_target_auth_user_id, v_target_id, v_target_name, v_target_email,
    'admin', 'manager'
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'employee_id', v_target_id,
    'name', v_target_name,
    'email', v_target_email,
    'new_system_role', 'manager'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_admin_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_admin_access(text) TO authenticated;

COMMENT ON FUNCTION public.remove_admin_access(text) IS
  'Removes admin access from another active administrator by demoting them to Manager; enforces admin authorization, self-removal and last-admin safeguards, and an audit log.';
