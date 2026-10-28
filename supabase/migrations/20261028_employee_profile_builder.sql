-- Togetherly Profile Builder: one submission groups independently reviewable claims.
-- This migration is additive; historical claims remain intact and ungrouped.

create table if not exists public.employee_profile_submissions (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  professional_summary text null check (professional_summary is null or pg_catalog.length(professional_summary) <= 3000),
  claimed_years_experience numeric(4,1) null check (claimed_years_experience is null or (claimed_years_experience >= 0 and claimed_years_experience <= 80)),
  resume_storage_path text null,
  resume_file_name text null check (resume_file_name is null or pg_catalog.length(resume_file_name) <= 180),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profile_submission_resume_path_valid check (
    resume_storage_path is null or pg_catalog.left(resume_storage_path, pg_catalog.length(employee_id) + 1) = (employee_id || '/')
  )
);

create index if not exists employee_profile_submissions_employee_submitted_idx
  on public.employee_profile_submissions (employee_id, submitted_at desc);

alter table public.employee_profile_claims
  add column if not exists submission_id uuid null references public.employee_profile_submissions(id) on delete set null;

create index if not exists employee_profile_claims_submission_idx
  on public.employee_profile_claims (submission_id, created_at asc)
  where submission_id is not null;

alter table public.employee_profile_claims
  drop constraint if exists employee_profile_claims_claim_type_check;
alter table public.employee_profile_claims
  add constraint employee_profile_claims_claim_type_check
  check (claim_type in ('skill', 'experience', 'certification', 'employment', 'education'));

alter table public.employee_profile_claims
  drop constraint if exists employee_profile_claim_employment_education_title_valid;
alter table public.employee_profile_claims
  add constraint employee_profile_claim_employment_education_title_valid
  check (claim_type not in ('employment', 'education') or nullif(pg_catalog.btrim(title), '') is not null);

alter table public.employee_profile_submissions enable row level security;

drop policy if exists "Employee and reviewers can view profile submissions" on public.employee_profile_submissions;
create policy "Employee and reviewers can view profile submissions"
  on public.employee_profile_submissions for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_reviewer_or_admin());

grant select on public.employee_profile_submissions to authenticated;
revoke all on public.employee_profile_submissions from anon;

-- Keep the existing single-claim resubmission pathway compatible with the new claim types.
create or replace function public.submit_employee_profile_claim(
  p_claim_type text,
  p_skill_id text default null,
  p_claimed_level integer default null,
  p_claimed_years numeric default null,
  p_title text default null,
  p_organization text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null,
  p_evidence_url text default null,
  p_evidence_label text default null,
  p_claim_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_employee_id text := public.current_employee_id();
  v_actor_name text;
  v_actor_role text := public.current_system_role();
  v_claim public.employee_profile_claims%rowtype;
  v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_claim_type, '')));
  v_title text := nullif(pg_catalog.btrim(coalesce(p_title, '')), '');
  v_org text := nullif(pg_catalog.btrim(coalesce(p_organization, '')), '');
  v_description text := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  v_evidence_url text := nullif(pg_catalog.btrim(coalesce(p_evidence_url, '')), '');
  v_evidence_label text := nullif(pg_catalog.btrim(coalesce(p_evidence_label, '')), '');
begin
  if v_uid is null or v_employee_id is null then
    raise exception 'Your account must be linked to an approved employee profile before submitting claims.';
  end if;

  if v_type not in ('skill', 'experience', 'certification', 'employment', 'education') then
    raise exception 'Claim type must be skill, experience, or certification.';
  end if;
  if p_claimed_level is not null and p_claimed_level not between 1 and 5 then
    raise exception 'Skill proficiency must be between 1 and 5.';
  end if;
  if v_type = 'skill' and (p_skill_id is null or p_claimed_level is null) then
    raise exception 'A skill and claimed proficiency are required for a skill claim.';
  end if;
  if v_type = 'experience' and (p_claimed_years is null or p_claimed_years < 0 or p_claimed_years > 80 or v_title is null) then
    raise exception 'Experience claims require a job title and total years of experience between 0 and 80.';
  end if;
  if v_type = 'certification' and v_title is null then
    raise exception 'A certification name is required.';
  end if;
  if v_type in ('employment', 'education') and v_title is null then
    raise exception 'A job title or qualification is required.';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'End date cannot be earlier than start date.';
  end if;
  if v_evidence_url is not null and v_evidence_url !~* '^https?://' then
    raise exception 'Evidence link must begin with https:// or http://.';
  end if;
  if pg_catalog.length(coalesce(v_title, '')) > 180 or pg_catalog.length(coalesce(v_org, '')) > 180
     or pg_catalog.length(coalesce(v_description, '')) > 3000
     or pg_catalog.length(coalesce(v_evidence_url, '')) > 1000
     or pg_catalog.length(coalesce(v_evidence_label, '')) > 180 then
    raise exception 'One or more profile claim fields exceed the allowed length.';
  end if;

  select e.name into v_actor_name
    from public.employees e where e.id = v_employee_id and e.auth_user_id = v_uid;
  if v_actor_name is null then
    raise exception 'The authenticated employee profile could not be verified.';
  end if;

  if p_claim_id is null then
    insert into public.employee_profile_claims (
      employee_id, claim_type, skill_id, claimed_level, claimed_years, title,
      organization, start_date, end_date, description, evidence_url, evidence_label,
      status, submitted_at, created_at, updated_at
    ) values (
      v_employee_id, v_type, case when v_type = 'skill' then p_skill_id else null end,
      case when v_type = 'skill' then p_claimed_level else null end,
      case when v_type = 'experience' then p_claimed_years else null end,
      v_title, v_org, p_start_date, p_end_date, v_description, v_evidence_url, v_evidence_label,
      'pending-verification', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    ) returning * into v_claim;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'submitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Profile claim submitted for verification.'
    );
  else
    update public.employee_profile_claims c
    set skill_id = case when v_type = 'skill' then p_skill_id else null end,
        claimed_level = case when v_type = 'skill' then p_claimed_level else null end,
        claimed_years = case when v_type = 'experience' then p_claimed_years else null end,
        title = v_title,
        organization = v_org,
        start_date = p_start_date,
        end_date = p_end_date,
        description = v_description,
        evidence_url = v_evidence_url,
        evidence_label = v_evidence_label,
        status = 'pending-verification',
        reviewer_employee_id = null,
        reviewer_name = null,
        reviewer_notes = null,
        reviewed_at = null,
        submitted_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where c.id = p_claim_id
      and c.employee_id = v_employee_id
      and c.claim_type = v_type
      and c.status in ('rejected', 'needs-more-evidence')
    returning * into v_claim;

    if v_claim.id is null then
      raise exception 'This claim cannot be resubmitted. Only your own rejected or evidence-requested claims can be resubmitted.';
    end if;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'resubmitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Claim resubmitted with updated information or evidence.'
    );
  end if;

  return pg_catalog.to_jsonb(v_claim);
end;
$function$;


revoke all on function public.submit_employee_profile_claim(text, text, integer, numeric, text, text, date, date, text, text, text, uuid) from public, anon;
grant execute on function public.submit_employee_profile_claim(text, text, integer, numeric, text, text, date, date, text, text, text, uuid) to authenticated;

create or replace function public.submit_employee_profile_package(
  p_professional_summary text default null,
  p_years_experience numeric default null,
  p_resume_storage_path text default null,
  p_resume_file_name text default null,
  p_claims jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_employee_id text := public.current_employee_id();
  v_actor_name text;
  v_actor_role text := public.current_system_role();
  v_summary text := nullif(pg_catalog.btrim(coalesce(p_professional_summary, '')), '');
  v_resume_path text := nullif(pg_catalog.btrim(coalesce(p_resume_storage_path, '')), '');
  v_resume_name text := nullif(pg_catalog.btrim(coalesce(p_resume_file_name, '')), '');
  v_submission public.employee_profile_submissions%rowtype;
  v_claim public.employee_profile_claims%rowtype;
  v_item jsonb;
  v_type text;
  v_skill_id text;
  v_level integer;
  v_title text;
  v_org text;
  v_description text;
  v_evidence_url text;
  v_evidence_label text;
  v_start_date date;
  v_end_date date;
  v_claim_count integer := 0;
  v_skill_count integer := 0;
begin
  if v_uid is null or v_employee_id is null then
    raise exception 'Your account must be linked to an approved employee profile before submitting a profile package.';
  end if;
  select e.name into v_actor_name
  from public.employees e
  where e.id = v_employee_id and e.auth_user_id = v_uid and e.employment_status = 'active';
  if v_actor_name is null then
    raise exception 'The authenticated employee profile could not be verified.';
  end if;

  if pg_catalog.length(coalesce(v_summary, '')) > 3000 then
    raise exception 'Professional summary must be 3000 characters or fewer.';
  end if;
  if p_years_experience is not null and (p_years_experience < 0 or p_years_experience > 80) then
    raise exception 'Total professional experience must be between 0 and 80 years.';
  end if;
  if p_claims is null or pg_catalog.jsonb_typeof(p_claims) <> 'array' then
    raise exception 'Profile items must be supplied as a list.';
  end if;
  if pg_catalog.jsonb_array_length(p_claims) > 60 then
    raise exception 'A profile package can contain at most 60 items.';
  end if;
  if pg_catalog.length(coalesce(v_resume_name, '')) > 180 then
    raise exception 'Resume filename must be 180 characters or fewer.';
  end if;

  if v_resume_path is not null then
    if pg_catalog.left(v_resume_path, pg_catalog.length(v_employee_id) + 1) <> v_employee_id || '/' then
      raise exception 'The resume path must belong to your employee profile.';
    end if;
    if v_resume_path !~ ('^' || v_employee_id || '/[A-Za-z0-9._-]+$') then
      raise exception 'The resume path contains invalid characters.';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'employee-profile-evidence' and o.name = v_resume_path
    ) then
      raise exception 'The uploaded resume was not found in private evidence storage.';
    end if;
    if v_resume_name is null or pg_catalog.lower(v_resume_name) not like '%.pdf' then
      raise exception 'The resume must be a PDF file.';
    end if;
  elsif v_resume_name is not null then
    raise exception 'A resume filename cannot be saved without an uploaded resume.';
  end if;

  insert into public.employee_profile_submissions (
    employee_id, professional_summary, claimed_years_experience,
    resume_storage_path, resume_file_name, submitted_at, created_at, updated_at
  ) values (
    v_employee_id, v_summary, p_years_experience, v_resume_path, v_resume_name,
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  ) returning * into v_submission;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_claims) as items(value)
  loop
    v_type := pg_catalog.lower(pg_catalog.btrim(coalesce(v_item->>'claim_type', '')));
    v_skill_id := nullif(pg_catalog.btrim(coalesce(v_item->>'skill_id', '')), '');
    v_level := nullif(v_item->>'claimed_level', '')::integer;
    v_title := nullif(pg_catalog.btrim(coalesce(v_item->>'title', '')), '');
    v_org := nullif(pg_catalog.btrim(coalesce(v_item->>'organization', '')), '');
    v_description := nullif(pg_catalog.btrim(coalesce(v_item->>'description', '')), '');
    v_evidence_url := nullif(pg_catalog.btrim(coalesce(v_item->>'evidence_url', '')), '');
    v_evidence_label := nullif(pg_catalog.btrim(coalesce(v_item->>'evidence_label', '')), '');
    v_start_date := nullif(v_item->>'start_date', '')::date;
    v_end_date := nullif(v_item->>'end_date', '')::date;

    if v_type not in ('skill', 'employment', 'education', 'certification') then
      raise exception 'Each profile item must be a skill, work experience, education, or certification.';
    end if;
    if v_type = 'skill' then
      if v_skill_id is null or v_level is null or v_level not between 1 and 5 then
        raise exception 'Each skill requires a catalogue skill and proficiency from 1 to 5.';
      end if;
      if not exists (select 1 from public.skills s where s.id = v_skill_id) then
        raise exception 'A selected skill no longer exists in the skill catalogue.';
      end if;
      if exists (select 1 from public.employee_profile_claims c where c.submission_id = v_submission.id and c.claim_type = 'skill' and c.skill_id = v_skill_id) then
        raise exception 'A skill can only appear once in a profile package.';
      end if;
      v_skill_count := v_skill_count + 1;
    elsif v_type in ('employment', 'education', 'certification') and v_title is null then
      raise exception 'Work experience, education, and certification items require a title.';
    end if;

    if v_start_date is not null and v_end_date is not null and v_end_date < v_start_date then
      raise exception 'End date cannot be earlier than start date.';
    end if;
    if v_evidence_url is not null and v_evidence_url !~* '^https?://' then
      raise exception 'Evidence links must begin with http:// or https://.';
    end if;
    if pg_catalog.length(coalesce(v_title, '')) > 180
       or pg_catalog.length(coalesce(v_org, '')) > 180
       or pg_catalog.length(coalesce(v_description, '')) > 3000
       or pg_catalog.length(coalesce(v_evidence_url, '')) > 1000
       or pg_catalog.length(coalesce(v_evidence_label, '')) > 180 then
      raise exception 'One or more profile item fields exceed the allowed length.';
    end if;

    insert into public.employee_profile_claims (
      submission_id, employee_id, claim_type, skill_id, claimed_level, claimed_years, title,
      organization, start_date, end_date, description, evidence_url, evidence_label,
      status, submitted_at, created_at, updated_at
    ) values (
      v_submission.id, v_employee_id, v_type, v_skill_id,
      case when v_type = 'skill' then v_level else null end,
      null, v_title, v_org, v_start_date, v_end_date, v_description, v_evidence_url,
      v_evidence_label, 'pending-verification', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    ) returning * into v_claim;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'submitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Profile item submitted as part of a complete employee profile package.'
    );
    v_claim_count := v_claim_count + 1;
  end loop;

  if v_skill_count = 0 then
    raise exception 'Add at least one skill before submitting your profile package.';
  end if;

  if p_years_experience is not null then
    insert into public.employee_profile_claims (
      submission_id, employee_id, claim_type, claimed_years, title, description,
      status, submitted_at, created_at, updated_at
    ) values (
      v_submission.id, v_employee_id, 'experience', p_years_experience,
      'Total professional experience', 'Total years claimed by the employee.',
      'pending-verification', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    ) returning * into v_claim;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'submitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Total professional experience submitted with a complete profile package.'
    );
    v_claim_count := v_claim_count + 1;
  end if;

  return pg_catalog.jsonb_build_object('submission', pg_catalog.to_jsonb(v_submission), 'claims_created', v_claim_count);
end;
$function$;

revoke all on function public.submit_employee_profile_package(text, numeric, text, text, jsonb) from public, anon;
grant execute on function public.submit_employee_profile_package(text, numeric, text, text, jsonb) to authenticated;
comment on table public.employee_profile_submissions is 'Groups an employee profile package while preserving each skill, employment, education, experience and certification item as an independently reviewable claim.';
