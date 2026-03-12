-- 010_deck_share_links.sql
-- Add share_token to flashy_decks for sharing decks via links.
-- A NULL token means the deck is private; a non-NULL UUID enables public read access.

ALTER TABLE flashy_decks
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL;

-- Index for fast lookup by share_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashy_decks_share_token
  ON flashy_decks (share_token)
  WHERE share_token IS NOT NULL;

-- RLS policy: allow anyone (authenticated) to read a deck by its share_token.
-- This lets students who receive a share link view and clone the deck.
CREATE POLICY "read_shared_decks"
  ON flashy_decks
  FOR SELECT
  USING (share_token IS NOT NULL);

-- Allow reading cards of a shared deck (cards reference deck_id)
CREATE POLICY "read_shared_deck_cards"
  ON flashy_cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM flashy_decks
      WHERE flashy_decks.id = flashy_cards.deck_id
        AND flashy_decks.share_token IS NOT NULL
    )
  );
