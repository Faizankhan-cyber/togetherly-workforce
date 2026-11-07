-- Togetherly V1 security and performance remediation.
-- This migration preserves the existing authorization model while reducing
-- unnecessary public RPC exposure and repeated per-row policy evaluation.

BEGIN;

-- Trigger functions are invoked by PostgreSQL triggers, not by application RPC.
-- Revoke direct execution from API roles while retaining trigger execution.
REVOKE EXECUTE ON FUNCTION public.enforce_employees_security_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_registration_request_security_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_training_assignment_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_training_submission_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_verification_audit_log_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_registration_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_verified_auth_user_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_rejected_employee_identity_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_employee_claims_to_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_employee_to_registration_request() FROM PUBLIC, anon, authenticated;

-- Add indexes for foreign-key columns reported by the live advisor.
CREATE INDEX IF NOT EXISTS idx_employee_offboarding_audit_offboarded_by ON public.employee_offboarding_audit (offboarded_by);
CREATE INDEX IF NOT EXISTS idx_employee_profile_claim_audit_actor_employee ON public.employee_profile_claim_audit (actor_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_profile_claim_audit_employee ON public.employee_profile_claim_audit (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_profile_claims_reviewer ON public.employee_profile_claims (reviewer_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_profile_claims_skill ON public.employee_profile_claims (skill_id);
CREATE INDEX IF NOT EXISTS idx_employee_registration_requests_employee ON public.employee_registration_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_registration_requests_reviewer ON public.employee_registration_requests (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_employees_offboarded_by ON public.employees (offboarded_by);
CREATE INDEX IF NOT EXISTS idx_project_requirements_skill ON public.project_requirements (skill_id);
CREATE INDEX IF NOT EXISTS idx_tinyfish_agent_runs_owner_employee ON public.tinyfish_agent_runs (owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_submission ON public.training_assignments (submission_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_skill ON public.training_assignments (skill_id);
CREATE INDEX IF NOT EXISTS idx_training_submissions_skill ON public.training_submissions (skill_id);

-- Remove redundant employee_skills indexes. The constraint-backed unique index
-- and employee_skills_employee_id_idx remain in place.
DROP INDEX IF EXISTS public.idx_employee_skills_employee;
DROP INDEX IF EXISTS public.employee_skills_employee_skill_uidx;

-- Employees directory visibility: retain active directory, own row, and reviewer access.
DROP POLICY IF EXISTS "Employees directory is visible to authenticated users" ON public.employees;
CREATE POLICY "Employees directory is visible to authenticated users"
  ON public.employees FOR SELECT TO authenticated
  USING (
    employment_status = 'active'
    OR auth_user_id = (SELECT auth.uid())
    OR (SELECT public.is_reviewer_or_admin())
  );

-- Employee self profile update: preserve verified identity and role guard settings.
DROP POLICY IF EXISTS "Employees can update their own profile contact info" ON public.employees;
CREATE POLICY "Employees can update their own profile contact info"
  ON public.employees FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) AND employment_status = 'active')
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND employment_status = 'active'
    AND id = COALESCE((SELECT current_setting('togetherly.verified_self_update_emp_id', true)), '')
    AND system_role = COALESCE((SELECT current_setting('togetherly.verified_self_update_role', true)), '')
  );

-- Reviewer employee insert/update policies: preserve the exact role restrictions.
DROP POLICY IF EXISTS "Reviewers and Admins can insert employees" ON public.employees;
CREATE POLICY "Reviewers and Admins can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_reviewer_or_admin())
    AND (
      system_role = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text])
      OR (SELECT public.current_system_role()) = 'admin'
    )
    AND (
      auth_user_id IS NULL
      OR auth_user_id <> (SELECT auth.uid())
      OR (SELECT public.current_system_role()) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Reviewers and Admins can update other employees" ON public.employees;
CREATE POLICY "Reviewers and Admins can update other employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_reviewer_or_admin())
    AND (
      auth_user_id IS NULL
      OR auth_user_id <> (SELECT auth.uid())
      OR (SELECT public.current_system_role()) = 'admin'
    )
    AND (
      system_role <> 'admin'
      OR (SELECT public.current_system_role()) = 'admin'
    )
  )
  WITH CHECK (
    (SELECT public.is_reviewer_or_admin())
    AND (
      auth_user_id IS NULL
      OR auth_user_id <> (SELECT auth.uid())
      OR (SELECT public.current_system_role()) = 'admin'
    )
    AND (
      system_role = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text])
      OR (SELECT public.current_system_role()) = 'admin'
    )
  );

-- Applicants can only read/create/update their own pending registration request.
DROP POLICY IF EXISTS "Applicants can view their own registration request" ON public.employee_registration_requests;
CREATE POLICY "Applicants can view their own registration request"
  ON public.employee_registration_requests FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Applicants can insert their own pending registration request" ON public.employee_registration_requests;
CREATE POLICY "Applicants can insert their own pending registration request"
  ON public.employee_registration_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND assigned_role IS NULL
    AND employee_id IS NULL
    AND reviewer_id IS NULL
  );

DROP POLICY IF EXISTS "Applicants can update their own pending request details" ON public.employee_registration_requests;
CREATE POLICY "Applicants can update their own pending request details"
  ON public.employee_registration_requests FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND assigned_role IS NULL
    AND employee_id IS NULL
    AND reviewer_id IS NULL
  );

-- TinyFish ownership checks: preserve both Auth and employee identity binding.
DROP POLICY IF EXISTS "Owners can create their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can create their TinyFish runs"
  ON public.tinyfish_agent_runs FOR INSERT TO authenticated
  WITH CHECK (
    owner_auth_user_id = (SELECT auth.uid())
    AND owner_employee_id = (SELECT public.current_employee_id())
    AND owner_role = (SELECT public.current_system_role())
    AND (SELECT public.current_system_role()) = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text, 'admin'::text])
  );

DROP POLICY IF EXISTS "Owners can view their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can view their TinyFish runs"
  ON public.tinyfish_agent_runs FOR SELECT TO authenticated
  USING (
    owner_auth_user_id = (SELECT auth.uid())
    AND owner_employee_id = (SELECT public.current_employee_id())
    AND owner_role = (SELECT public.current_system_role())
    AND (SELECT public.current_system_role()) = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text, 'admin'::text])
  );

-- Own training progress: preserve the existing verification and submission guards.
DROP POLICY IF EXISTS "Employees can update their own assignment progress" ON public.training_assignments;
CREATE POLICY "Employees can update their own assignment progress"
  ON public.training_assignments FOR UPDATE TO authenticated
  USING (
    employee_id = (SELECT public.current_employee_id())
    AND verification_status <> 'verified'
  )
  WITH CHECK (
    employee_id = (SELECT public.current_employee_id())
    AND id = COALESCE((SELECT current_setting('togetherly.verified_assignment_update_id', true)), '')
    AND verification_status = ANY (ARRAY['not-started'::text, 'in-progress'::text, 'pending-verification'::text])
    AND (
      verification_status <> 'pending-verification'
      OR (
        submission_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.training_submissions s
          WHERE s.id = training_assignments.submission_id
            AND s.employee_id = (SELECT public.current_employee_id())
            AND s.status = 'pending-verification'
        )
      )
    )
  );

-- Employee skill visibility remains limited to the active directory, own record, and reviewers.
DROP POLICY IF EXISTS "Active directory or own employee skills visible" ON public.employee_skills;
CREATE POLICY "Active directory or own employee skills visible"
  ON public.employee_skills FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT public.current_employee_id())
    OR (SELECT public.is_reviewer_or_admin())
    OR EXISTS (
      SELECT 1
      FROM public.employees AS employee
      WHERE employee.id = employee_skills.employee_id
        AND (
          employee.employment_status = 'active'
          OR employee.auth_user_id = (SELECT auth.uid())
        )
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
