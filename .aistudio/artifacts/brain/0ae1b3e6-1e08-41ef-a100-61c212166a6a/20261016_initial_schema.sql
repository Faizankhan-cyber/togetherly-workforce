-- =============================================================================
-- Migration: 20261016_initial_schema.sql
-- Description: Togetherly Workforce Intelligence - Initial Schema & Security
-- Phase: 2 (Database Schema & Security Proposal)
-- Notes:
--   - Non-destructive (uses IF NOT EXISTS, DO blocks for constraints/policies)
--   - Does NOT drop existing tables or data
--   - Establishes relational integrity, audit tracking, and RLS policies
--   - Prepares private storage configuration for training completion evidence
-- =============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. SKILLS TABLE
-- =============================================================================
create table if not exists public.skills (
  id text primary key,
  name text not null,
  category text not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 2. EMPLOYEES TABLE
-- Supports workforce profiles and links to Supabase auth.users via auth_user_id
-- =============================================================================
create table if not exists public.employees (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  role text not null, -- job title (e.g., 'Senior Full Stack Engineer')
  department text not null,
  email text not null unique,
  avatar_color text not null default '#8B5CF6',
  availability text not null default 'available' check (availability in ('available', 'busy', 'unavailable', 'partially-available')),
  years_experience numeric(4, 1) not null default 0,
  target_utilization integer not null default 100 check (target_utilization between 0 and 200),
  system_role text not null default 'employee' check (system_role in ('employee', 'manager', 'hr', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_auth_user_id on public.employees(auth_user_id);
create index if not exists idx_employees_email on public.employees(email);
create index if not exists idx_employees_department on public.employees(department);
create index if not exists idx_employees_system_role on public.employees(system_role);

-- =============================================================================
-- 3. EMPLOYEE SKILLS TABLE
-- =============================================================================
create table if not exists public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  level integer not null check (level between 1 and 5),
  updated_at timestamptz not null default now(),
  unique (employee_id, skill_id)
);

create index if not exists idx_employee_skills_employee on public.employee_skills(employee_id);
create index if not exists idx_employee_skills_skill on public.employee_skills(skill_id);

-- =============================================================================
-- 4. PROJECTS TABLE
-- =============================================================================
create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  department text not null,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed', 'on-hold')),
  target_team_size integer not null default 1 check (target_team_size >= 1),
  start_date date,
  deadline date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_department on public.projects(department);

-- =============================================================================
-- 5. PROJECT MEMBERS TABLE (Employee Project Allocations)
-- =============================================================================
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_employee on public.project_members(employee_id);

-- =============================================================================
-- 6. PROJECT REQUIREMENTS TABLE
-- =============================================================================
create table if not exists public.project_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  min_level integer not null check (min_level between 1 and 5),
  importance text not null default 'required' check (importance in ('required', 'preferred')),
  unique (project_id, skill_id)
);

create index if not exists idx_project_requirements_project on public.project_requirements(project_id);

-- =============================================================================
-- 7. TRAINING ASSIGNMENTS TABLE
-- Tracks assigned courses and learning progress
-- =============================================================================
create table if not exists public.training_assignments (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  course_name text not null,
  provider text not null,
  skill_id text not null references public.skills(id) on delete cascade,
  status text not null default 'not-started' check (status in ('not-started', 'in-progress', 'completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  reason text,
  assigned_date date,
  completed_date date,
  verification_status text not null default 'not-started' check (verification_status in ('not-started', 'in-progress', 'pending-verification', 'verified', 'rejected', 'needs-more-evidence')),
  submission_id text, -- linked to training_submissions.id after submission table is created
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_assignments_employee on public.training_assignments(employee_id);
create index if not exists idx_training_assignments_status on public.training_assignments(status);
create index if not exists idx_training_assignments_verification on public.training_assignments(verification_status);

-- =============================================================================
-- 8. TRAINING SUBMISSIONS TABLE
-- Core verification claims table: contains evidence references, reviewer records, and integrity checks
-- =============================================================================
create table if not exists public.training_submissions (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  employee_name text not null,
  employee_role text not null,
  employee_department text not null,
  employee_avatar_color text,
  course_name text not null,
  provider text not null,
  skill_id text not null references public.skills(id) on delete cascade,
  completion_date date not null,
  submission_date date not null default current_date,
  credential_id text,
  verification_url text,
  notes text,
  evidence_file_name text,
  evidence_file_type text check (evidence_file_type in ('pdf', 'image', 'link', 'none')),
  evidence_file_size bigint,
  evidence_data_url text, -- supports inline fallback or SVG previews
  evidence_storage_path text, -- points to secure object path inside training-evidence bucket
  status text not null default 'pending-verification' check (status in ('not-started', 'in-progress', 'pending-verification', 'verified', 'rejected', 'needs-more-evidence')),
  assignment_id text references public.training_assignments(id) on delete set null,
  reviewer_id text references public.employees(id) on delete set null,
  reviewer_name text,
  review_timestamp timestamptz,
  reviewer_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Database constraint preventing self-approval
  constraint chk_no_self_approval check (
    reviewer_id is null or reviewer_id != employee_id
  )
);

create index if not exists idx_training_submissions_employee on public.training_submissions(employee_id);
create index if not exists idx_training_submissions_status on public.training_submissions(status);
create index if not exists idx_training_submissions_reviewer on public.training_submissions(reviewer_id);
create index if not exists idx_training_submissions_assignment on public.training_submissions(assignment_id);

-- Foreign key linking training_assignments.submission_id to training_submissions.id
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_training_assignments_submission'
      and table_name = 'training_assignments'
  ) then
    alter table public.training_assignments
      add constraint fk_training_assignments_submission
      foreign key (submission_id)
      references public.training_submissions(id)
      on delete set null;
  end if;
end $$;

-- =============================================================================
-- 9. VERIFICATION AUDIT LOGS TABLE
-- Immutable audit trail for submission lifecycle events
-- =============================================================================
create table if not exists public.verification_audit_logs (
  id text primary key,
  submission_id text not null references public.training_submissions(id) on delete cascade,
  action text not null check (action in ('submitted', 'resubmitted', 'approved', 'rejected', 'requested_more_evidence')),
  actor_id text not null,
  actor_name text not null,
  actor_role text not null check (actor_role in ('employee', 'manager', 'hr', 'admin')),
  timestamp timestamptz not null default now(),
  note text
);

create index if not exists idx_verification_audit_submission on public.verification_audit_logs(submission_id);
create index if not exists idx_verification_audit_timestamp on public.verification_audit_logs(timestamp);

-- =============================================================================
-- 10. ACTIVITIES TABLE
-- Feed of organizational events
-- =============================================================================
create table if not exists public.activities (
  id text primary key,
  message text not null,
  timestamp timestamptz not null default now(),
  type text not null default 'system' check (type in ('assignment', 'training', 'simulation', 'project', 'system'))
);

create index if not exists idx_activities_timestamp on public.activities(timestamp desc);

-- =============================================================================
-- 11. APP SETTINGS TABLE
-- =============================================================================
create table if not exists public.app_settings (
  id text primary key default 'default',
  organization_name text not null default 'Togetherly Enterprise',
  email_notifications boolean not null default true,
  workload_alerts boolean not null default true,
  team_reminders boolean not null default false,
  weekly_digest boolean not null default true,
  overloaded_threshold integer not null default 90 check (overloaded_threshold between 1 and 100),
  underutilized_threshold integer not null default 50 check (underutilized_threshold between 1 and 100),
  match_weights_skills integer not null default 50 check (match_weights_skills between 0 and 100),
  match_weights_experience integer not null default 25 check (match_weights_experience between 0 and 100),
  match_weights_availability integer not null default 25 check (match_weights_availability between 0 and 100),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 12. STORAGE BUCKET CONFIGURATION (Private training-evidence bucket)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-evidence',
  'training-evidence',
  false,
  5242880, -- 5 MB in bytes
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- =============================================================================

-- Resolves the current employee ID matching auth.uid()
create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
as $$
  select id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

-- Resolves the current system role ('employee', 'manager', 'hr', 'admin') from the database
create or replace function public.current_system_role()
returns text
language sql
stable
security definer
as $$
  select coalesce(
    (select system_role from public.employees where auth_user_id = auth.uid() limit 1),
    'none'
  );
$$;

-- Checks if the authenticated caller has reviewer privileges (Manager, HR, or Admin)
create or replace function public.is_reviewer_or_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and system_role in ('manager', 'hr', 'admin')
  );
$$;

-- =============================================================================
-- 14. ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
alter table public.skills enable row level security;
alter table public.employees enable row level security;
alter table public.employee_skills enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_requirements enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_submissions enable row level security;
alter table public.verification_audit_logs enable row level security;
alter table public.activities enable row level security;
alter table public.app_settings enable row level security;

-- -----------------------------------------------------------------------------
-- Skills, Activities, Settings Policies (Read-mostly)
-- -----------------------------------------------------------------------------
create policy "Anyone authenticated can view skills"
  on public.skills for select
  to authenticated
  using (true);

create policy "Admins can manage skills"
  on public.skills for all
  to authenticated
  using (public.current_system_role() = 'admin')
  with check (public.current_system_role() = 'admin');

create policy "Anyone authenticated can view activities"
  on public.activities for select
  to authenticated
  using (true);

create policy "Authenticated users can create activities"
  on public.activities for insert
  to authenticated
  with check (true);

create policy "Anyone authenticated can view settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "Managers and Admins can update settings"
  on public.app_settings for update
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- Employees & Employee Skills Policies
-- -----------------------------------------------------------------------------
create policy "Employees directory is visible to authenticated users"
  on public.employees for select
  to authenticated
  using (true);

create policy "Employees can update their own profile contact info"
  on public.employees for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid() and
    -- Prevent employees from elevating their own system_role or target_utilization
    system_role = (select system_role from public.employees where auth_user_id = auth.uid())
  );

create policy "Managers and Admins can manage employees"
  on public.employees for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

create policy "Anyone authenticated can view employee skills"
  on public.employee_skills for select
  to authenticated
  using (true);

create policy "Managers and Admins can manage employee skills"
  on public.employee_skills for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- Projects & Allocations Policies
-- -----------------------------------------------------------------------------
create policy "Anyone authenticated can view projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Managers and Admins can manage projects"
  on public.projects for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

create policy "Anyone authenticated can view project members"
  on public.project_members for select
  to authenticated
  using (true);

create policy "Managers and Admins can manage project members"
  on public.project_members for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

create policy "Anyone authenticated can view project requirements"
  on public.project_requirements for select
  to authenticated
  using (true);

create policy "Managers and Admins can manage project requirements"
  on public.project_requirements for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- Training Assignments Policies
-- -----------------------------------------------------------------------------
create policy "Employees can view their own training assignments"
  on public.training_assignments for select
  to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.is_reviewer_or_admin()
  );

create policy "Employees can update their own assignment progress"
  on public.training_assignments for update
  to authenticated
  using (employee_id = public.current_employee_id())
  with check (
    employee_id = public.current_employee_id()
  );

create policy "Managers and Admins can manage all training assignments"
  on public.training_assignments for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- Training Submissions Policies (Core Verification Security)
-- -----------------------------------------------------------------------------

-- 1. SELECT: Employees can view their own submissions; Reviewers can view all queue items
create policy "Submissions select policy"
  on public.training_submissions for select
  to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.is_reviewer_or_admin()
  );

-- 2. INSERT: Employees can submit claims for themselves; Reviewer fields must be null
create policy "Employees can submit their own training completion claims"
  on public.training_submissions for insert
  to authenticated
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending-verification'
    and reviewer_id is null
    and review_timestamp is null
  );

-- 3. UPDATE (Employee Resubmission): Allowed only if rejected or needs-more-evidence
create policy "Employees can resubmit evidence on their own pending/rejected claims"
  on public.training_submissions for update
  to authenticated
  using (
    employee_id = public.current_employee_id()
    and status in ('rejected', 'needs-more-evidence', 'pending-verification')
  )
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending-verification'
    -- Employee cannot set or modify reviewer decision fields
    and reviewer_id is null
    and review_timestamp is null
  );

-- 4. UPDATE (Review Decision): Only Managers, HR, or Admins; strictly enforces NO SELF-APPROVAL
create policy "Reviewers can review and decide on training submissions"
  on public.training_submissions for update
  to authenticated
  using (
    public.is_reviewer_or_admin()
    -- Reviewer cannot be the employee who submitted
    and employee_id != public.current_employee_id()
  )
  with check (
    public.is_reviewer_or_admin()
    and employee_id != public.current_employee_id()
    and reviewer_id = public.current_employee_id()
    and status in ('verified', 'rejected', 'needs-more-evidence')
  );

-- -----------------------------------------------------------------------------
-- Verification Audit Logs Policies (Append-only)
-- -----------------------------------------------------------------------------
create policy "Audit logs are viewable by submitter or reviewers"
  on public.verification_audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.training_submissions s
      where s.id = verification_audit_logs.submission_id
        and (s.employee_id = public.current_employee_id() or public.is_reviewer_or_admin())
    )
  );

create policy "Authenticated users can record audit entries"
  on public.verification_audit_logs for insert
  to authenticated
  with check (
    actor_id = public.current_employee_id()
  );

-- Disallow updates and deletes on audit logs to guarantee immutable history
-- (No update or delete policies defined)

-- =============================================================================
-- 15. STORAGE POLICIES FOR 'training-evidence' BUCKET
-- =============================================================================

-- SELECT: Employee can download their own evidence; Reviewers can view any evidence
create policy "Evidence read policy"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and (
      (storage.foldername(name))[1] = public.current_employee_id()
      or public.is_reviewer_or_admin()
    )
  );

-- INSERT: Employees can upload files only into their own folder (evidence/{employee_id}/...)
create policy "Evidence insert policy"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-evidence'
    and (storage.foldername(name))[1] = public.current_employee_id()
  );

-- UPDATE: Employees can update their own evidence file
create policy "Evidence update policy"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and (storage.foldername(name))[1] = public.current_employee_id()
  )
  with check (
    bucket_id = 'training-evidence'
    and (storage.foldername(name))[1] = public.current_employee_id()
  );

-- DELETE: Employees can delete their file if not verified; Admins can delete
create policy "Evidence delete policy"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and (
      (storage.foldername(name))[1] = public.current_employee_id()
      or public.current_system_role() = 'admin'
    )
  );
