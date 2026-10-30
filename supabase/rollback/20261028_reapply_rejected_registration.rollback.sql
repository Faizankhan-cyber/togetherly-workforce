-- Rollback for supabase/migrations/20261028_reapply_rejected_registration.sql
-- Captured from production BEFORE the migration, on 2026-10-30.
-- This is a function-only rollback: it removes the new RPC and restores the previous
-- registration-request trigger body. It does NOT restore rows if the RPC was already used.
-- Do not run this as a substitute for a database backup/PITR restore.

BEGIN;

DROP FUNCTION IF EXISTS public.reapply_my_registration_request(text, text, text);

CREATE OR REPLACE FUNCTION public.enforce_registration_request_security_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_admin_ctx boolean;
begin
  v_is_admin_ctx := public.is_trusted_admin_context();

  if tg_op = 'DELETE' then
    if not v_is_admin_ctx then
      raise exception 'Access denied: only an authorized administrator can delete registration requests.';
    end if;
    return old;
  end if;

  new.email := pg_catalog.btrim(coalesce(new.email, ''));
  new.applicant_name := pg_catalog.btrim(coalesce(new.applicant_name, 'Applicant'));
  new.requested_department := coalesce(nullif(pg_catalog.btrim(new.requested_department), ''), 'Engineering');

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, pg_catalog.now());
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if auth.uid() is null or new.auth_user_id != auth.uid() then
        raise exception 'Security violation: you can only create a registration request for your own auth_user_id.';
      end if;
      new.status := 'pending';
      new.assigned_role := null;
      new.assigned_department := null;
      new.assigned_job_title := null;
      new.employee_id := null;
      new.reviewer_id := null;
      new.reviewer_name := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.auth_user_id := old.auth_user_id;
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if auth.uid() is null or old.auth_user_id != auth.uid() then
        raise exception 'Access denied: you can only update your own pending registration request.';
      end if;
      if old.status != 'pending' then
        raise exception 'Security violation: processed registration requests cannot be modified by the applicant.';
      end if;
      if new.status is distinct from old.status
         or new.assigned_role is distinct from old.assigned_role
         or new.assigned_department is distinct from old.assigned_department
         or new.assigned_job_title is distinct from old.assigned_job_title
         or new.employee_id is distinct from old.employee_id
         or new.reviewer_id is distinct from old.reviewer_id
         or new.reviewer_name is distinct from old.reviewer_name
         or new.reviewed_at is distinct from old.reviewed_at
         or new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'Security violation: applicants cannot modify approval status, role assignments, or review fields.';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$function$
;

COMMIT;
NOTIFY pgrst, 'reload schema';
