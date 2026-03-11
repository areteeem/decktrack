-- =====================================================
-- FLASHY MIGRATION 002: Row Level Security policies
-- Run in Supabase SQL Editor after 001_flashy_tables.sql
-- =====================================================

-- ─────────────────────────────────────────────────────
-- flashy_profiles
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON flashy_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Teachers can read profiles of their students
CREATE POLICY "profiles_teacher_read_students"
  ON flashy_profiles FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON flashy_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Teachers can update their students' profiles
CREATE POLICY "profiles_teacher_update_students"
  ON flashy_profiles FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Allow insert for the auto-create trigger (SECURITY DEFINER handles this)
-- Also allow authenticated users to insert their own
CREATE POLICY "profiles_insert_own"
  ON flashy_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────
-- flashy_decks
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_decks ENABLE ROW LEVEL SECURITY;

-- Owner (teacher or student) can CRUD their own decks
CREATE POLICY "decks_select_own"
  ON flashy_decks FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Teachers can see decks of their students
CREATE POLICY "decks_teacher_read_student_decks"
  ON flashy_decks FOR SELECT TO authenticated
  USING (
    owner_id IN (
      SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "decks_insert_own"
  ON flashy_decks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "decks_update_own"
  ON flashy_decks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "decks_delete_own"
  ON flashy_decks FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- flashy_cards
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_cards ENABLE ROW LEVEL SECURITY;

-- Owner of the deck can CRUD cards
CREATE POLICY "cards_select_deck_owner"
  ON flashy_cards FOR SELECT TO authenticated
  USING (
    deck_id IN (SELECT id FROM flashy_decks WHERE owner_id = auth.uid())
  );

-- Teachers can read cards in their students' decks
CREATE POLICY "cards_teacher_read_student_cards"
  ON flashy_cards FOR SELECT TO authenticated
  USING (
    deck_id IN (
      SELECT id FROM flashy_decks WHERE owner_id IN (
        SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
      )
    )
  );

-- Students can read cards via assigned decks (so sync trigger copies work)
CREATE POLICY "cards_student_read_assigned"
  ON flashy_cards FOR SELECT TO authenticated
  USING (
    deck_id IN (
      SELECT teacher_deck_id FROM flashy_deck_assignments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "cards_insert_deck_owner"
  ON flashy_cards FOR INSERT TO authenticated
  WITH CHECK (
    deck_id IN (SELECT id FROM flashy_decks WHERE owner_id = auth.uid())
  );

CREATE POLICY "cards_update_deck_owner"
  ON flashy_cards FOR UPDATE TO authenticated
  USING (
    deck_id IN (SELECT id FROM flashy_decks WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    deck_id IN (SELECT id FROM flashy_decks WHERE owner_id = auth.uid())
  );

CREATE POLICY "cards_delete_deck_owner"
  ON flashy_cards FOR DELETE TO authenticated
  USING (
    deck_id IN (SELECT id FROM flashy_decks WHERE owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────
-- flashy_deck_assignments
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_deck_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers can manage assignments they created
CREATE POLICY "assignments_teacher_select"
  ON flashy_deck_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Students can see their own assignments
CREATE POLICY "assignments_student_select"
  ON flashy_deck_assignments FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "assignments_teacher_insert"
  ON flashy_deck_assignments FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "assignments_teacher_update"
  ON flashy_deck_assignments FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "assignments_teacher_delete"
  ON flashy_deck_assignments FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- flashy_student_cards
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_student_cards ENABLE ROW LEVEL SECURITY;

-- Students can read/update their own cards
CREATE POLICY "student_cards_select_own"
  ON flashy_student_cards FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "student_cards_update_own"
  ON flashy_student_cards FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can CRUD student cards for their students
CREATE POLICY "student_cards_teacher_select"
  ON flashy_student_cards FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

CREATE POLICY "student_cards_teacher_insert"
  ON flashy_student_cards FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

CREATE POLICY "student_cards_teacher_update"
  ON flashy_student_cards FOR UPDATE TO authenticated
  USING (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

CREATE POLICY "student_cards_teacher_delete"
  ON flashy_student_cards FOR DELETE TO authenticated
  USING (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────
-- flashy_activity_log
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own activity
CREATE POLICY "activity_select_own"
  ON flashy_activity_log FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Teachers can read activity of their students
CREATE POLICY "activity_teacher_select"
  ON flashy_activity_log FOR SELECT TO authenticated
  USING (
    actor_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- Anyone authenticated can insert their own activity
CREATE POLICY "activity_insert_own"
  ON flashy_activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- flashy_study_sessions
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_study_sessions ENABLE ROW LEVEL SECURITY;

-- Students can read/insert their own sessions
CREATE POLICY "sessions_select_own"
  ON flashy_study_sessions FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "sessions_insert_own"
  ON flashy_study_sessions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "sessions_update_own"
  ON flashy_study_sessions FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- Teachers can read sessions of their students
CREATE POLICY "sessions_teacher_select"
  ON flashy_study_sessions FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────
-- flashy_notifications
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read and update (mark read) their own notifications
CREATE POLICY "notifications_select_own"
  ON flashy_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON flashy_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Teachers can insert notifications for their students
CREATE POLICY "notifications_teacher_insert"
  ON flashy_notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────
-- flashy_card_comments
-- ─────────────────────────────────────────────────────
ALTER TABLE flashy_card_comments ENABLE ROW LEVEL SECURITY;

-- Teachers can insert comments (they are the author)
CREATE POLICY "comments_insert_author"
  ON flashy_card_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Students can read comments on their cards
CREATE POLICY "comments_student_select"
  ON flashy_card_comments FOR SELECT TO authenticated
  USING (
    student_card_id IN (
      SELECT id FROM flashy_student_cards WHERE student_id = auth.uid()
    )
  );

-- Teachers can read comments they authored
CREATE POLICY "comments_teacher_select"
  ON flashy_card_comments FOR SELECT TO authenticated
  USING (author_id = auth.uid());
