-- ─────────────────────────────────────────────────────
-- 009: Allow teachers to manage student personal decks & cards
-- Teachers can UPDATE, DELETE student-owned decks and cards
-- ─────────────────────────────────────────────────────

-- Teacher can update student personal decks (e.g. archive, rename)
CREATE POLICY "decks_teacher_update_student_decks"
  ON flashy_decks FOR UPDATE TO authenticated
  USING (
    owner_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- Teacher can delete student personal decks
CREATE POLICY "decks_teacher_delete_student_decks"
  ON flashy_decks FOR DELETE TO authenticated
  USING (
    owner_id IN (SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid())
  );

-- Teacher can update cards in student personal decks
CREATE POLICY "cards_teacher_update_student_cards"
  ON flashy_cards FOR UPDATE TO authenticated
  USING (
    deck_id IN (
      SELECT id FROM flashy_decks WHERE owner_id IN (
        SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    deck_id IN (
      SELECT id FROM flashy_decks WHERE owner_id IN (
        SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
      )
    )
  );

-- Teacher can delete cards in student personal decks
CREATE POLICY "cards_teacher_delete_student_cards"
  ON flashy_cards FOR DELETE TO authenticated
  USING (
    deck_id IN (
      SELECT id FROM flashy_decks WHERE owner_id IN (
        SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
      )
    )
  );

-- Teacher can insert cards into student personal decks
CREATE POLICY "cards_teacher_insert_student_cards"
  ON flashy_cards FOR INSERT TO authenticated
  WITH CHECK (
    deck_id IN (
      SELECT id FROM flashy_decks WHERE owner_id IN (
        SELECT id FROM flashy_profiles WHERE teacher_id = auth.uid()
      )
    )
  );
