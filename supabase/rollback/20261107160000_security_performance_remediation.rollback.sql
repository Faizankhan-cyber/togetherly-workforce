-- Manual rollback for 20261107160000_security_performance_remediation.sql.
-- Review against the live schema before use. This restores the pre-migration policy
-- expressions and grants, removes added FK indexes, and restores the two redundant
-- employee_skills indexes. It does not reverse application data changes.

BEGIN;

GRANT EXECUTE ON FUNCTION public.enforce_employees_security_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_registration_request_security_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_training_assignment_update_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_training_submission_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_verification_audit_log_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_registration_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_verified_auth_user_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_rejected_employee_identity_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_employee_claims_to_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_employee_to_registration_request() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON public.employee_skills (employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_skills_employee_skill_uidx ON public.employee_skills (employee_id, skill_id);

DROP INDEX IF EXISTS public.idx_employee_offboarding_audit_offboarded_by;
DROP INDEX IF EXISTS public.idx_employee_profile_claim_audit_actor_employee;
DROP INDEX IF EXISTS public.idx_employee_profile_claim_audit_employee;
DROP INDEX IF EXISTS public.idx_employee_profile_claims_reviewer;
DROP INDEX IF EXISTS public.idx_employee_profile_claims_skill;
DROP INDEX IF EXISTS public.idx_employee_registration_requests_employee;
DROP INDEX IF EXISTS public.idx_employee_registration_requests_reviewer;
DROP INDEX IF EXISTS public.idx_employees_offboarded_by;
DROP INDEX IF EXISTS public.idx_project_requirements_skill;
DROP INDEX IF EXISTS public.idx_tinyfish_agent_runs_owner_employee;
DROP INDEX IF EXISTS public.idx_training_assignments_submission;
DROP INDEX IF EXISTS public.idx_training_assignments_skill;
DROP INDEX IF EXISTS public.idx_training_submissions_skill;

DROP POLICY IF EXISTS "Employees directory is visible to authenticated users" ON public.employees;
CREATE POLICY "Employees directory is visible to authenticated users"
  ON public.employees FOR SELECT TO authenticated
  USING (employment_status = 'active' OR auth_user_id = auth.uid() OR public.is_reviewer_or_admin());

DROP POLICY IF EXISTS "Employees can update their own profile contact info" ON public.employees;
CREATE POLICY "Employees can update their own profile contact info"
  ON public.employees FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND employment_status = 'active')
  WITH CHECK (
    auth_user_id = auth.uid()
    AND employment_status = 'active'
    AND id = COALESCE(current_setting('togetherly.verified_self_update_emp_id'::text, true), ''::text)
    AND system_role = COALESCE(current_setting('togetherly.verified_self_update_role'::text, true), ''::text)
  );

DROP POLICY IF EXISTS "Reviewers and Admins can insert employees" ON public.employees;
CREATE POLICY "Reviewers and Admins can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    is_reviewer_or_admin()
    AND ((system_role = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text])) OR (current_system_role() = 'admin'::text))
    AND ((auth_user_id IS NULL) OR (auth_user_id <> auth.uid()) OR (current_system_role() = 'admin'::text))
  );

DROP POLICY IF EXISTS "Reviewers and Admins can update other employees" ON public.employees;
CREATE POLICY "Reviewers and Admins can update other employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    is_reviewer_or_admin()
    AND ((auth_user_id IS NULL) OR (auth_user_id <> auth.uid()) OR (current_system_role() = 'admin'::text))
    AND ((system_role <> 'admin'::text) OR (current_system_role() = 'admin'::text))
  )
  WITH CHECK (
    is_reviewer_or_admin()
    AND ((auth_user_id IS NULL) OR (auth_user_id <> auth.uid()) OR (current_system_role() = 'admin'::text))
    AND ((system_role = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text])) OR (current_system_role() = 'admin'::text))
  );

DROP POLICY IF EXISTS "Applicants can view their own registration request" ON public.employee_registration_requests;
CREATE POLICY "Applicants can view their own registration request"
  ON public.employee_registration_requests FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Applicants can insert their own pending registration request" ON public.employee_registration_requests;
CREATE POLICY "Applicants can insert their own pending registration request"
  ON public.employee_registration_requests FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() AND status = 'pending'::text AND assigned_role IS NULL AND employee_id IS NULL AND reviewer_id IS NULL);

DROP POLICY IF EXISTS "Applicants can update their own pending request details" ON public.employee_registration_requests;
CREATE POLICY "Applicants can update their own pending request details"
  ON public.employee_registration_requests FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND status = 'pending'::text)
  WITH CHECK (auth_user_id = auth.uid() AND status = 'pending'::text AND assigned_role IS NULL AND employee_id IS NULL AND reviewer_id IS NULL);

DROP POLICY IF EXISTS "Owners can create their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can create their TinyFish runs"
  ON public.tinyfish_agent_runs FOR INSERT TO authenticated
  WITH CHECK (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = current_employee_id()
    AND owner_role = current_system_role()
    AND current_system_role() = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text, 'admin'::text])
  );

DROP POLICY IF EXISTS "Owners can view their TinyFish runs" ON public.tinyfish_agent_runs;
CREATE POLICY "Owners can view their TinyFish runs"
  ON public.tinyfish_agent_runs FOR SELECT TO authenticated
  USING (
    owner_auth_user_id = auth.uid()
    AND owner_employee_id = current_employee_id()
    AND owner_role = current_system_role()
    AND current_system_role() = ANY (ARRAY['employee'::text, 'manager'::text, 'hr'::text, 'admin'::text])
  );

DROP POLICY IF EXISTS "Employees can update their own assignment progress" ON public.training_assignments;
CREATE POLICY "Employees can update their own assignment progress"
  ON public.training_assignments FOR UPDATE TO authenticated
  USING (employee_id = current_employee_id() AND verification_status <> 'verified'::text)
  WITH CHECK (
    employee_id = current_employee_id()
    AND id = COALESCE(current_setting('togetherly.verified_assignment_update_id'::text, true), ''::text)
    AND verification_status = ANY (ARRAY['not-started'::text, 'in-progress'::text, 'pending-verification'::text])
    AND (
      verification_status <> 'pending-verification'::text
      OR (
        submission_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM training_submissions s
          WHERE s.id = training_assignments.submission_id
            AND s.employee_id = current_employee_id()
            AND s.status = 'pending-verification'::text
        )
      )
    )
  );

DROP POLICY IF EXISTS "Active directory or own employee skills visible" ON public.employee_skills;
CREATE POLICY "Active directory or own employee skills visible"
  ON public.employee_skills FOR SELECT TO authenticated
  USING (
    employee_id = current_employee_id()
    OR is_reviewer_or_admin()
    OR EXISTS (
      SELECT 1 FROM employees employee
      WHERE employee.id = employee_skills.employee_id
        AND (employee.employment_status = 'active'::text OR employee.auth_user_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
