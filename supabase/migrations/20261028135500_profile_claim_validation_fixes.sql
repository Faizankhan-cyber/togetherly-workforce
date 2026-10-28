-- Let employees submit an experience-only profile package without inventing a skill claim.
-- Keep this additive migration so existing databases receive the validation fix.

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

  if v_claim_count = 0 and p_years_experience is null then
    raise exception 'Add at least one profile item or enter total professional experience before submitting your profile package.';
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

notify pgrst, 'reload schema';
