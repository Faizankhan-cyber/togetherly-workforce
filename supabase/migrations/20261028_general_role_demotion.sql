-- General downshift support for Manager and HR accounts.
-- Administrator demotion deliberately stays on remove_admin_access, which protects the last active admin.

CREATE OR REPLACE FUNCTION public.demote_employee_system_role(
  p_employee_id text,
  p_target_role text
)
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
  v_target_role text;
  v_target_status text;
  v_new_role text := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_target_role, '')));
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(780281, 4271);

  SELECT e.id, e.name
  INTO v_actor_employee_id, v_actor_name
  FROM public.employees AS e
  WHERE e.auth_user_id = v_actor_id
    AND e.system_role = 'admin'
    AND e.employment_status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can demote accounts.';
  END IF;

  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Select an account to demote.';
  END IF;

  IF v_new_role <> 'employee' THEN
    RAISE EXCEPTION 'Manager and HR demotions must assign the Employee role. Use the protected Admin Access workflow for administrator demotions.';
  END IF;

  SELECT e.id, e.auth_user_id, e.name, e.email, e.system_role, e.employment_status
  INTO v_target_id, v_target_auth_user_id, v_target_name, v_target_email, v_target_role, v_target_status
  FROM public.employees AS e
  WHERE e.id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected account was not found.';
  END IF;

  IF v_target_auth_user_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot demote your own account.';
  END IF;

  IF v_target_status <> 'active' OR v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Only active, linked workspace accounts can be demoted.';
  END IF;

  IF v_target_role NOT IN ('manager', 'hr') THEN
    RAISE EXCEPTION 'Only an active Manager or HR account can use this demotion action. Administrator demotions must use the protected Admin Access workflow.';
  END IF;

  UPDATE public.employees AS e
  SET system_role = 'employee',
      updated_at = pg_catalog.now()
  WHERE e.id = v_target_id
    AND e.employment_status = 'active'
    AND e.system_role = v_target_role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The account changed before the demotion could be completed. Refresh and try again.';
  END IF;

  INSERT INTO public.admin_access_audit_logs (
    actor_auth_user_id, actor_employee_id, actor_name,
    target_auth_user_id, target_employee_id, target_name, target_email,
    from_system_role, to_system_role
  ) VALUES (
    v_actor_id, v_actor_employee_id, v_actor_name,
    v_target_auth_user_id, v_target_id, v_target_name, v_target_email,
    v_target_role, 'employee'
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'employee_id', v_target_id,
    'name', v_target_name,
    'email', v_target_email,
    'previous_system_role', v_target_role,
    'new_system_role', 'employee'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.demote_employee_system_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demote_employee_system_role(text, text) TO authenticated;

COMMENT ON FUNCTION public.demote_employee_system_role(text, text) IS
  'Allows active admins to demote linked active Manager or HR accounts to Employee with an audit entry. Admin-account demotion remains on remove_admin_access to protect the last active administrator.';
