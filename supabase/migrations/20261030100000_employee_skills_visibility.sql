-- Limit employee skill reads to the active directory, the signed-in employee's own history, and reviewers.
DROP POLICY IF EXISTS "Anyone authenticated can view employee skills" ON public.employee_skills;
DROP POLICY IF EXISTS "Active directory or own employee skills visible" ON public.employee_skills;

CREATE POLICY "Active directory or own employee skills visible"
  ON public.employee_skills
  FOR SELECT
  TO authenticated
  USING (
    employee_id = public.current_employee_id()
    OR public.is_reviewer_or_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees AS employee
      WHERE employee.id = employee_skills.employee_id
        AND (
          employee.employment_status = 'active'
          OR employee.auth_user_id = auth.uid()
        )
    )
  );

CREATE INDEX IF NOT EXISTS employee_skills_employee_id_idx
  ON public.employee_skills (employee_id);

NOTIFY pgrst, 'reload schema';
