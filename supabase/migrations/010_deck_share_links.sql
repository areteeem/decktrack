-- ─────────────────────────────────────────────────────
-- 010: Deck share links (public token-based read + clone flow)
-- ─────────────────────────────────────────────────────

-- Add token used in /shared/:token route.
ALTER TABLE flashy_decks
  ADD COLUMN IF NOT EXISTS share_token UUID;

-- Share token must be unique when set.
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashy_decks_share_token
  ON flashy_decks (share_token)
  WHERE share_token IS NOT NULL;

-- Recreate policies idempotently for local/dev re-runs.
DROP POLICY IF EXISTS "decks_select_shared_by_token" ON flashy_decks;
DROP POLICY IF EXISTS "cards_select_shared_deck_cards" ON flashy_cards;

-- Allow reading decks that have a share token (works for anon + authenticated).
CREATE POLICY "decks_select_shared_by_token"
  ON flashy_decks FOR SELECT TO public
  USING (share_token IS NOT NULL);

-- Allow reading cards for decks that are shared.
CREATE POLICY "cards_select_shared_deck_cards"
  ON flashy_cards FOR SELECT TO public
  USING (
    deck_id IN (
      SELECT id
      FROM flashy_decks
      WHERE share_token IS NOT NULL
    )
  );
