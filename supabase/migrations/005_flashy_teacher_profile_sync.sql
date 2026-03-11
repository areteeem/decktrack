-- =====================================================
-- FLASHY MIGRATION 005: Sync teacher profiles into Flashy
-- Run in Supabase SQL Editor after 004_flashy_claim_student.sql
-- Ensures existing and future TutPro teachers become Flashy teachers.
-- =====================================================

CREATE OR REPLACE FUNCTION public.flashy_sync_teacher_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.flashy_profiles (
    id,
    role,
    teacher_id,
    display_name,
    email
  )
  VALUES (
    NEW.user_id,
    'teacher',
    NULL,
    COALESCE(NULLIF(TRIM(NEW.display_name), ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE
    SET role = 'teacher',
        teacher_id = NULL,
        display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), flashy_profiles.display_name),
        email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), flashy_profiles.email),
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flashy_on_teacher_profile_sync ON public.teacher_profiles;
CREATE TRIGGER flashy_on_teacher_profile_sync
AFTER INSERT OR UPDATE OF email, display_name ON public.teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION public.flashy_sync_teacher_profile();

-- Backfill existing teachers immediately.
INSERT INTO public.flashy_profiles (
  id,
  role,
  teacher_id,
  display_name,
  email
)
SELECT
  tp.user_id,
  'teacher',
  NULL,
  COALESCE(NULLIF(TRIM(tp.display_name), ''), split_part(COALESCE(tp.email, ''), '@', 1)),
  COALESCE(tp.email, '')
FROM public.teacher_profiles tp
ON CONFLICT (id) DO UPDATE
  SET role = 'teacher',
      teacher_id = NULL,
      display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), flashy_profiles.display_name),
      email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), flashy_profiles.email),
      updated_at = NOW();
