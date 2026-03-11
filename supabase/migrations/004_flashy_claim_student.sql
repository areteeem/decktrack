-- =====================================================
-- FLASHY MIGRATION 004: Teacher claims existing student
-- Run in Supabase SQL Editor after 003_flashy_sync_triggers.sql
-- =====================================================

CREATE OR REPLACE FUNCTION public.flashy_claim_student(
  student_email CITEXT,
  student_display_name TEXT DEFAULT NULL
)
RETURNS public.flashy_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_teacher flashy_profiles;
  target_student flashy_profiles;
BEGIN
  SELECT *
  INTO current_teacher
  FROM flashy_profiles
  WHERE id = auth.uid();

  IF current_teacher.id IS NULL OR current_teacher.role <> 'teacher' THEN
    RAISE EXCEPTION 'Only teacher accounts can link students.';
  END IF;

  SELECT *
  INTO target_student
  FROM flashy_profiles
  WHERE email = student_email
    AND role = 'student'
  LIMIT 1;

  IF target_student.id IS NULL THEN
    RAISE EXCEPTION 'Student account not found. Ask the student to sign in once first.';
  END IF;

  IF target_student.teacher_id IS NOT NULL AND target_student.teacher_id <> auth.uid() THEN
    RAISE EXCEPTION 'This student is already linked to another teacher.';
  END IF;

  UPDATE flashy_profiles
  SET
    teacher_id = auth.uid(),
    display_name = COALESCE(NULLIF(student_display_name, ''), display_name),
    updated_at = NOW()
  WHERE id = target_student.id
  RETURNING * INTO target_student;

  RETURN target_student;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_claim_student(CITEXT, TEXT) TO authenticated;
