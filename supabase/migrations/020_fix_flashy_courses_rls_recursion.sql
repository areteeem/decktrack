-- =====================================================
-- FLASHY MIGRATION 020: Fix course RLS recursion
-- =====================================================
-- The previous course policies referenced each other via tables with RLS,
-- which can trigger "infinite recursion detected in policy for relation
-- flashy_courses" in nested course/member queries.
--
-- This migration adds SECURITY DEFINER helper functions and rewires policies
-- to use them, avoiding policy-to-policy recursion.
-- =====================================================

CREATE OR REPLACE FUNCTION public.flashy_is_course_owner(
  p_course_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.flashy_courses c
    WHERE c.id = p_course_id
      AND c.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.flashy_is_course_member(
  p_course_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.flashy_course_members m
    WHERE m.course_id = p_course_id
      AND m.student_id = p_student_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.flashy_is_course_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flashy_is_course_member(UUID, UUID) TO authenticated;

-- Recreate course-members policies via helpers
DROP POLICY IF EXISTS "course_members_owner_all" ON public.flashy_course_members;
CREATE POLICY "course_members_owner_all" ON public.flashy_course_members
  FOR ALL TO authenticated
  USING (public.flashy_is_course_owner(course_id, auth.uid()))
  WITH CHECK (public.flashy_is_course_owner(course_id, auth.uid()));

DROP POLICY IF EXISTS "course_members_student_read_own" ON public.flashy_course_members;
CREATE POLICY "course_members_student_read_own" ON public.flashy_course_members
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Recreate student course visibility policy via helper
DROP POLICY IF EXISTS "courses_student_read" ON public.flashy_courses;
CREATE POLICY "courses_student_read" ON public.flashy_courses
  FOR SELECT TO authenticated
  USING (public.flashy_is_course_member(id, auth.uid()));

-- Recreate course-deck policies via helpers
DROP POLICY IF EXISTS "course_decks_owner_all" ON public.flashy_course_decks;
CREATE POLICY "course_decks_owner_all" ON public.flashy_course_decks
  FOR ALL TO authenticated
  USING (public.flashy_is_course_owner(course_id, auth.uid()))
  WITH CHECK (public.flashy_is_course_owner(course_id, auth.uid()));

DROP POLICY IF EXISTS "course_decks_student_read" ON public.flashy_course_decks;
CREATE POLICY "course_decks_student_read" ON public.flashy_course_decks
  FOR SELECT TO authenticated
  USING (public.flashy_is_course_member(course_id, auth.uid()));

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
