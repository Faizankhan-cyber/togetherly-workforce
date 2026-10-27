-- Expand admin demotion so the active administrator must choose the target role.
ALTER TABLE public.admin_access_audit_logs
  DROP CONSTRAINT IF EXISTS admin_access_audit_logs_to_system_role_check;
ALTER TABLE public.admin_access_audit_logs
  ADD CONSTRAINT admin_access_audit_logs_to_system_role_check
  CHECK (to_system_role IN ('hr', 'manager', 'employee'));

DROP FUNCTION IF EXISTS public.remove_admin_access(text);
CREATE OR REPLACE FUNCTION public.remove_admin_access(p_employee_id text, p_target_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(780281, 4271);
  SELECT e.id, e.name INTO v_actor_employee_id, v_actor_name
    FROM public.employees AS e
    WHERE e.auth_user_id = v_actor_id AND e.system_role = 'admin' AND e.employment_status = 'active'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied: only an active administrator can remove admin access.'; END IF;
  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Validation error: select an administrator account.';
  END IF;
  IF p_target_role IS NULL OR p_target_role NOT IN ('hr', 'manager', 'employee') THEN
    RAISE EXCEPTION 'Validation error: choose HR, Manager, or Employee as the target role.';
  END IF;
  SELECT e.id, e.auth_user_id, e.name, e.email, e.system_role, e.employment_status
    INTO v_target_id, v_target_auth_user_id, v_target_name, v_target_email, v_target_system_role, v_target_employment_status
    FROM public.employees AS e WHERE e.id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator account not found.'; END IF;
  IF v_target_auth_user_id = v_actor_id THEN RAISE EXCEPTION 'You cannot remove your own administrator access.'; END IF;
  IF v_target_system_role <> 'admin' OR v_target_employment_status <> 'active' OR v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'This account is not an active administrator.';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_active_admin_count
    FROM public.employees AS e WHERE e.system_role = 'admin' AND e.employment_status = 'active' AND e.auth_user_id IS NOT NULL;
  IF v_active_admin_count <= 1 THEN RAISE EXCEPTION 'The last active administrator cannot be removed.'; END IF;
  UPDATE public.employees AS e SET system_role = p_target_role, updated_at = pg_catalog.now()
    WHERE e.id = v_target_id AND e.system_role = 'admin' AND e.employment_status = 'active';
  INSERT INTO public.admin_access_audit_logs (
    actor_auth_user_id, actor_employee_id, actor_name, target_auth_user_id, target_employee_id,
    target_name, target_email, from_system_role, to_system_role
  ) VALUES (
    v_actor_id, v_actor_employee_id, v_actor_name, v_target_auth_user_id, v_target_id,
    v_target_name, v_target_email, 'admin', p_target_role
  );
  RETURN pg_catalog.jsonb_build_object('success', true, 'employee_id', v_target_id, 'name', v_target_name,
    'email', v_target_email, 'new_system_role', p_target_role);
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_admin_access(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_admin_access(text, text) TO authenticated;
COMMENT ON FUNCTION public.remove_admin_access(text, text) IS
  'Demotes another active administrator to an explicitly selected HR, Manager, or Employee role; enforces admin authorization, self-removal and last-admin protections, and an audit log.';

-- Expand TinyFish Agent run ownership to employees while keeping strict ownership checks.
ALTER TABLE public.tinyfish_agent_runs DROP CONSTRAINT IF EXISTS tinyfish_agent_runs_owner_role_check;
ALTER TABLE public.tinyfish_agent_runs ADD CONSTRAINT tinyfish_agent_runs_owner_role_check
  CHECK (owner_role IN ('employee', 'manager', 'hr', 'admin'));
DROP POLICY IF EXISTS "Owners can create their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can create their TinyFish runs" ON public.tinyfish_agent_runs
  FOR INSERT TO authenticated WITH CHECK (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = public.current_employee_id()
    AND owner_role = public.current_system_role()
    AND public.current_system_role() IN ('employee', 'manager', 'hr', 'admin')
  );
DROP POLICY IF EXISTS "Owners can view their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can view their TinyFish runs" ON public.tinyfish_agent_runs
  FOR SELECT TO authenticated USING (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = public.current_employee_id()
    AND owner_role = public.current_system_role()
    AND public.current_system_role() IN ('employee', 'manager', 'hr', 'admin')
  );
COMMENT ON TABLE public.tinyfish_agent_runs IS
  'Owner-scoped registry for metered TinyFish Agent runs available to active linked employee, manager, HR, and admin accounts.';
