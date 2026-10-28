-- Admin-only query for the recent role-change audit timeline.
CREATE OR REPLACE FUNCTION public.list_admin_role_audit_events(p_limit integer DEFAULT 12)
RETURNS TABLE (
  id uuid,
  actor_name text,
  target_name text,
  target_email text,
  from_system_role text,
  to_system_role text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);
BEGIN
  IF auth.uid() IS NULL OR public.current_system_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can view role-change audit history.';
  END IF;

  RETURN QUERY
  SELECT audit.id, audit.actor_name, audit.target_name, audit.target_email,
         audit.from_system_role, audit.to_system_role, audit.created_at
  FROM public.admin_access_audit_logs AS audit
  ORDER BY audit.created_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_admin_role_audit_events(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_role_audit_events(integer) TO authenticated;

COMMENT ON FUNCTION public.list_admin_role_audit_events(integer) IS
  'Returns recent administrator role-change audit events to active administrators only, with a bounded limit.';
