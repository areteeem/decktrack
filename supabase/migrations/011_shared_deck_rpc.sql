-- ─────────────────────────────────────────────────────
-- 011: Shared deck RPC (works across accounts without relying on RLS policy shape)
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.flashy_get_shared_deck(
  p_share_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_token TEXT := NULLIF(BTRIM(p_share_token), '');
  deck_record flashy_decks%ROWTYPE;
  cards_payload JSONB;
BEGIN
  IF normalized_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO deck_record
  FROM flashy_decks
  WHERE share_token::TEXT = normalized_token
  LIMIT 1;

  IF deck_record.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'front', c.front,
        'back', c.back,
        'example_sentence', c.example_sentence,
        'sort_order', c.sort_order
      )
      ORDER BY c.sort_order ASC
    ),
    '[]'::JSONB
  )
  INTO cards_payload
  FROM flashy_cards c
  WHERE c.deck_id = deck_record.id;

  RETURN jsonb_build_object(
    'deck', jsonb_build_object(
      'id', deck_record.id,
      'name', deck_record.name,
      'description', deck_record.description,
      'category', deck_record.category,
      'difficulty_level', deck_record.difficulty_level,
      'tags', deck_record.tags,
      'language_pair', deck_record.language_pair,
      'owner_id', deck_record.owner_id
    ),
    'cards', cards_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.flashy_get_shared_deck(TEXT) TO anon, authenticated;
