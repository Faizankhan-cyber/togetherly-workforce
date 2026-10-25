-- Private evidence files for employee skill, experience and certification claims.
ALTER TABLE public.employee_profile_claims
  ADD COLUMN IF NOT EXISTS evidence_storage_path text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employee_profile_claims'::regclass
      AND conname = 'employee_profile_claim_evidence_storage_path_valid'
  ) THEN
    ALTER TABLE public.employee_profile_claims
      ADD CONSTRAINT employee_profile_claim_evidence_storage_path_valid
      CHECK (evidence_storage_path IS NULL OR evidence_storage_path ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$');
  END IF;
END;
$block$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-profile-evidence',
  'employee-profile-evidence',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

DROP POLICY IF EXISTS "Employees upload own profile evidence" ON storage.objects;
CREATE POLICY "Employees upload own profile evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-profile-evidence'
  AND public.current_employee_id() IS NOT NULL
  AND split_part(name, '/', 1) = public.current_employee_id()
);

DROP POLICY IF EXISTS "Employees and reviewers read profile evidence" ON storage.objects;
CREATE POLICY "Employees and reviewers read profile evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-profile-evidence'
  AND (
    split_part(name, '/', 1) = public.current_employee_id()
    OR public.is_reviewer_or_admin()
  )
);

DROP POLICY IF EXISTS "Employees remove own failed profile uploads" ON storage.objects;
CREATE POLICY "Employees remove own failed profile uploads"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-profile-evidence'
  AND split_part(name, '/', 1) = public.current_employee_id()
);

CREATE OR REPLACE FUNCTION public.submit_employee_profile_claim_with_evidence(
  p_claim_type text,
  p_skill_id text DEFAULT NULL,
  p_claimed_level integer DEFAULT NULL,
  p_claimed_years numeric DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_evidence_label text DEFAULT NULL,
  p_claim_id uuid DEFAULT NULL,
  p_evidence_storage_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_employee_id text := public.current_employee_id();
  v_path text := nullif(pg_catalog.btrim(coalesce(p_evidence_storage_path, '')), '');
  v_result jsonb;
  v_claim_id uuid;
  v_claim public.employee_profile_claims%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Your account must be linked to an approved employee profile before submitting claims.';
  END IF;

  IF v_path IS NOT NULL THEN
    IF v_path !~ ('^' || v_employee_id || '/[A-Za-z0-9._-]+$') THEN
      RAISE EXCEPTION 'Evidence file path must belong to your own employee profile.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'employee-profile-evidence' AND o.name = v_path
    ) THEN
      RAISE EXCEPTION 'The evidence file was not found in private evidence storage.';
    END IF;
  END IF;

  v_result := public.submit_employee_profile_claim(
    p_claim_type, p_skill_id, p_claimed_level, p_claimed_years, p_title,
    p_organization, p_start_date, p_end_date, p_description, p_evidence_url,
    p_evidence_label, p_claim_id
  );
  v_claim_id := (v_result ->> 'id')::uuid;
  IF v_claim_id IS NULL THEN
    RAISE EXCEPTION 'The profile claim could not be saved.';
  END IF;

  UPDATE public.employee_profile_claims c
  SET evidence_storage_path = coalesce(v_path, c.evidence_storage_path),
      updated_at = pg_catalog.now()
  WHERE c.id = v_claim_id AND c.employee_id = v_employee_id
  RETURNING * INTO v_claim;

  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'The saved claim could not be linked to your evidence file.';
  END IF;

  RETURN pg_catalog.to_jsonb(v_claim);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_employee_profile_claim_with_evidence(text, text, integer, numeric, text, text, date, date, text, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_employee_profile_claim_with_evidence(text, text, integer, numeric, text, text, date, date, text, text, text, uuid, text) TO authenticated;

COMMENT ON COLUMN public.employee_profile_claims.evidence_storage_path IS 'Private Supabase Storage object path; only the employee and authorized reviewers can obtain signed access URLs.';
