/**
 * Supabase data hooks — replaces all Apollo/GraphQL queries and mutations.
 * Provides React hooks for decks, cards, student cards, assignments, etc.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { extractRosterStudents } from '../lib/tutproRoster';

const STUDY_RETENTION_DAYS = 30;
const STUDY_RETENTION_MS = STUDY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const FLASHY_CACHE_PREFIX = 'flashy_cache_v1';
const FLASHY_CACHE_TTL_MS = 10 * 60 * 1000;

const getStudyCutoffIso = () => new Date(Date.now() - STUDY_RETENTION_MS).toISOString();

const buildFlashyCacheKey = (...parts) => `${FLASHY_CACHE_PREFIX}:${parts.map((value) => String(value || '').trim()).join(':')}`;

const readFlashyCache = (cacheKey, maxAgeMs = FLASHY_CACHE_TTL_MS) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    if (!savedAt || (Date.now() - savedAt) > maxAgeMs) return null;
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
};

const isLocalStorageQuotaError = (error) => {
  if (!error) return false;
  const code = Number(error?.code);
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 22
    || code === 1014
    || name.includes('quota')
    || message.includes('quota')
    || message.includes('storage full');
};

const getFlashyCacheEntriesByAge = () => {
  if (typeof window === 'undefined') return [];
  try {
    const entries = [];
    const prefix = `${FLASHY_CACHE_PREFIX}:`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let savedAt = 0;
      try {
        const parsed = JSON.parse(raw);
        savedAt = Number(parsed?.savedAt || 0);
      } catch {
        savedAt = 0;
      }
      entries.push({ key, savedAt });
    }
    return entries.sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  }
};

const evictOldestFlashyCacheEntry = (protectedKey = '') => {
  const candidates = getFlashyCacheEntriesByAge().filter((entry) => entry.key !== protectedKey);
  if (!candidates.length) return false;
  try {
    localStorage.removeItem(candidates[0].key);
    return true;
  } catch {
    return false;
  }
};

const writeFlashyCache = (cacheKey, payload) => {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify({
    savedAt: Date.now(),
    payload,
  });

  try {
    localStorage.setItem(cacheKey, serialized);
    return;
  } catch (error) {
    if (!isLocalStorageQuotaError(error)) return;
  }

  for (let attempts = 0; attempts < 40; attempts += 1) {
    const evicted = evictOldestFlashyCacheEntry(cacheKey);
    if (!evicted) break;
    try {
      localStorage.setItem(cacheKey, serialized);
      return;
    } catch (retryError) {
      if (!isLocalStorageQuotaError(retryError)) return;
    }
  }
};

const enrichStudySession = (session) => {
  const startedAtRaw = session?.started_at || session?.finished_at || session?.created_at || null;
  const startedTs = startedAtRaw ? Date.parse(startedAtRaw) : NaN;
  if (!Number.isFinite(startedTs)) {
    return {
      ...session,
      days_until_deletion: null,
      deletion_at: null,
    };
  }

  const deletionTs = startedTs + STUDY_RETENTION_MS;
  const remainingMs = Math.max(0, deletionTs - Date.now());
  const daysUntilDeletion = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return {
    ...session,
    days_until_deletion: daysUntilDeletion,
    deletion_at: new Date(deletionTs).toISOString(),
  };
};

const getFriendlySupabaseErrorMessage = (error, fallbackMessage) => {
  const rawMessage = String(error?.message || fallbackMessage || 'Unexpected Supabase error');
  if (
    rawMessage.includes("Could not find the 'card_type' column of 'flashy_cards'")
    || rawMessage.includes("Could not find the 'card_type' column of 'flashy_student_cards'")
  ) {
    return 'Supabase is missing the latest card_type migration. Apply migration 018 before creating or editing fill-in-the-blank cards.';
  }
  return rawMessage;
};

// ─────────────────────────────────────────────────────
// Decks
// ─────────────────────────────────────────────────────

/** Fetch all decks for the current user (with card counts) */
export const useDecks = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchedAt = useRef(0);
  const isFetchingRef = useRef(false);

  const refetch = useCallback(async ({ background = false } = {}) => {
    if (!user) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    // Dedupe: skip if a fetch is already in-flight
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!background) setLoading(true);
    try {
      const { data: decks, error: err } = await supabase
        .from('flashy_decks')
        .select('*, flashy_cards(id)')
        .eq('owner_id', user.id)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (err) {
        setError(err);
        if (!background) setData([]);
        return;
      }

      // Attach card count
      const enriched = (decks || []).map(d => ({
        ...d,
        cardCount: d.flashy_cards?.length ?? 0,
        flashcards: d.flashy_cards || [],
      }));
      const nonArchivedDecks = enriched.filter((deck) => deck?.is_archived !== true);
      setData(nonArchivedDecks);
      setError(null);
      lastFetchedAt.current = Date.now();
      writeFlashyCache(buildFlashyCacheKey('decks', user.id), nonArchivedDecks);
    } catch (err) {
      console.error('[useDecks] refetch failed:', err?.message || err);
      setError(err);
      if (!background) setData([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  // Initial load: cache-first, then background network refresh
  useEffect(() => {
    if (!user) {
      refetch();
      return;
    }
    const cacheKey = buildFlashyCacheKey('decks', user.id);
    const cachedDecks = readFlashyCache(cacheKey);
    const normalizedCachedDecks = Array.isArray(cachedDecks)
      ? cachedDecks.filter((deck) => deck?.is_archived !== true)
      : null;
    const hasCachedDecks = Array.isArray(normalizedCachedDecks);
    if (hasCachedDecks) {
      setData(normalizedCachedDecks);
      setError(null);
      setLoading(false);
      lastFetchedAt.current = Date.now();
    }
    refetch({ background: hasCachedDecks });
  }, [refetch, user]);

  // Background refresh: re-fetch every 60 s and on tab focus (stale > 30 s)
  useEffect(() => {
    if (!user) return;
    const STALE_MS = 30_000;
    const bgRefetch = () => {
      if (Date.now() - lastFetchedAt.current > STALE_MS) {
        refetch({ background: true });
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') bgRefetch();
    };
    const intervalId = setInterval(bgRefetch, 60_000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', bgRefetch);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', bgRefetch);
    };
  }, [user, refetch]);

  return { data, loading, error, refetch };
};

/** Fetch archived decks for the current user */
export const useArchivedDecks = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: decks, error: err } = await supabase
        .from('flashy_decks')
        .select('*, flashy_cards(id)')
        .eq('owner_id', user.id)
        .eq('is_archived', true)
        .order('created_at', { ascending: false });
      if (err) { setData([]); return; }
      const enriched = (decks || []).map(d => ({
        ...d,
        cardCount: d.flashy_cards?.length ?? 0,
      }));
      setData(enriched);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Fetch a single deck with all its cards */
export const useDeck = (deckId) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ background = false } = {}) => {
    if (!user || !deckId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!background) setLoading(true);
    try {
      const { data: deck, error: err } = await supabase
        .from('flashy_decks')
        .select('*, flashy_cards(*)')
        .eq('id', deckId)
        .maybeSingle();

      if (err) {
        setError(err);
        setData(null);
        return;
      }

      if (deck) {
        deck.flashcards = (deck.flashy_cards || []).sort(
          (a, b) => (b.retention || 0) - (a.retention || 0)
        );
        delete deck.flashy_cards;
      }
      setData(deck);
      setError(null);

      const cacheKey = buildFlashyCacheKey('deck_cards', user.id, deckId);
      if (deck?.is_archived === true) {
        try { localStorage.removeItem(cacheKey); } catch { /* ignore */ }
      } else if (deck) {
        writeFlashyCache(cacheKey, deck);
      }
    } catch (err) {
      console.error('[useDeck] refetch failed:', err?.message || err);
      setError(err);
      if (!background) setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, deckId]);

  useEffect(() => {
    if (!user || !deckId) {
      refetch();
      return;
    }
    const cacheKey = buildFlashyCacheKey('deck_cards', user.id, deckId);
    const cachedDeck = readFlashyCache(cacheKey);
    const hasCachedDeck = Boolean(cachedDeck && typeof cachedDeck === 'object' && cachedDeck?.is_archived !== true);
    if (hasCachedDeck) {
      setData(cachedDeck);
      setError(null);
      setLoading(false);
    }
    refetch({ background: hasCachedDeck });
  }, [deckId, refetch, user]);

  return { data, loading, error, refetch };
};

/** Create a new deck */
export const useCreateDeck = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createDeck = async (fields) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);
    const { data, error } = await supabase
      .from('flashy_decks')
      .insert({ ...fields, owner_id: user.id })
      .select()
      .single();
    setLoading(false);
    if (error) throw new Error(error.message || 'Failed to create deck');
    return data;
  };

  return { createDeck, loading };
};

/** Delete a deck and all its cards (cascade) */
export const useDeleteDeck = () => {
  const [loading, setLoading] = useState(false);

  const deleteDeck = async (deckId) => {
    setLoading(true);
    // Cards cascade-delete via FK
    const { error } = await supabase
      .from('flashy_decks')
      .delete()
      .eq('id', deckId);
    setLoading(false);
    if (error) throw new Error(error.message || 'Failed to delete deck');
  };

  return { deleteDeck, loading };
};

// ─────────────────────────────────────────────────────
// Cards (teacher master cards)
// ─────────────────────────────────────────────────────

/** Create a flashcard in a deck */
export const useCreateCard = () => {
  const [loading, setLoading] = useState(false);

  const createCard = async (fields) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('flashy_cards')
      .insert(fields)
      .select()
      .single();
    setLoading(false);
    if (error) throw new Error(getFriendlySupabaseErrorMessage(error, 'Failed to create card'));
    return data;
  };

  return { createCard, loading };
};

/** Create many flashcards in batches */
export const useCreateCardsBulk = () => {
  const [loading, setLoading] = useState(false);

  const createCardsBulk = async (cards, { chunkSize = 100 } = {}) => {
    const normalizedCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
    if (!normalizedCards.length) return [];

    setLoading(true);

    try {
      const inserted = [];

      for (let index = 0; index < normalizedCards.length; index += chunkSize) {
        const chunk = normalizedCards.slice(index, index + chunkSize);
        const { data, error } = await supabase
          .from('flashy_cards')
          .insert(chunk)
          .select();

        if (error) throw new Error(getFriendlySupabaseErrorMessage(error, 'Failed to create cards'));
        inserted.push(...(data || []));
      }

      return inserted;
    } finally {
      setLoading(false);
    }
  };

  return { createCardsBulk, loading };
};

/** Update a flashcard */
export const useUpdateCard = () => {
  const [loading, setLoading] = useState(false);

  const updateCard = async (id, fields) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('flashy_cards')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);
    if (error) throw new Error(getFriendlySupabaseErrorMessage(error, 'Failed to update card'));
    return data;
  };

  return { updateCard, loading };
};

/** Delete a flashcard */
export const useDeleteCard = () => {
  const [loading, setLoading] = useState(false);

  const deleteCard = async (id) => {
    setLoading(true);
    const { error } = await supabase
      .from('flashy_cards')
      .delete()
      .eq('id', id);
    setLoading(false);
    if (error) throw new Error(error.message || 'Failed to delete card');
  };

  return { deleteCard, loading };
};

// ─────────────────────────────────────────────────────
// Student Cards (student's copies with SRS state)
// ─────────────────────────────────────────────────────

/** Fetch student cards for a given assignment (deck) */
export const useStudentDeckCards = (assignmentId) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ background = false } = {}) => {
    if (!user || !assignmentId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!background) setLoading(true);
    try {
      const { data: cards, error: err } = await supabase
        .from('flashy_student_cards')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .eq('is_deleted_by_teacher', false)
        .order('sort_order')
        .order('created_at');

      if (err) {
        setError(err);
        if (!background) setData([]);
        return;
      }

      setData(cards || []);
      setError(null);
      writeFlashyCache(buildFlashyCacheKey('student_assignment_cards', user.id, assignmentId), cards || []);
    } catch (err) {
      console.error('[useStudentDeckCards] refetch failed:', err?.message || err);
      setError(err);
      if (!background) setData([]);
    } finally {
      setLoading(false);
    }
  }, [user, assignmentId]);

  useEffect(() => {
    if (!user || !assignmentId) {
      refetch();
      return;
    }
    const cacheKey = buildFlashyCacheKey('student_assignment_cards', user.id, assignmentId);
    const cachedCards = readFlashyCache(cacheKey, 2 * 60 * 1000);
    const hasCachedCards = Array.isArray(cachedCards);
    if (hasCachedCards) {
      setData(cachedCards);
      setError(null);
      setLoading(false);
    }
    refetch({ background: hasCachedCards });
  }, [assignmentId, refetch, user]);

  return { data, loading, error, refetch };
};

/**
 * Fetch ALL cards from the current user's own (personal) decks.
 * Cards are in flashy_cards → flashy_decks with owner_id = current user.
 * Used for cross-deck study so personal deck cards are included.
 */
export const useAllOwnDeckCards = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: cards } = await supabase
        .from('flashy_cards')
        .select('*, flashy_decks!inner(id, name, owner_id, is_archived)')
        .eq('flashy_decks.owner_id', user.id)
        .eq('flashy_decks.is_archived', false);

      setData((cards || []).map(c => ({
        ...c,
        new: c.is_new,
        nextReview: c.next_review_days,
        _personal: true,
      })));
    } catch (err) {
      console.error('[useAllOwnDeckCards] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/**
 * Fetch due cards — for teachers reads flashy_cards directly,
 * for students reads flashy_student_cards.
 * @param {string} [deckId] — if provided, filter to one deck
 */
export const useDueCards = (deckId) => {
  const { user, isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // When deckId is provided we always use flashy_cards (owner path)
  // because both teacher and student-created decks store cards there.
  // The student-assignment path (flashy_student_cards) is only used for
  // cross-deck mode (no deckId) which is a teacher-only route.
  const useOwnerPath = isTeacher || !!deckId;

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (useOwnerPath) {
        let query = supabase
          .from('flashy_cards')
          .select('*, flashy_decks!inner(owner_id, is_archived)')
          .eq('flashy_decks.owner_id', user.id)
          .eq('flashy_decks.is_archived', false)
          .eq('is_new', false)
          .eq('mastered', false)
          .lt('due', new Date().toISOString());
        if (deckId) query = query.eq('deck_id', deckId);
        const { data: cards } = await query;
        // Normalize field names for components
        setData((cards || []).map(c => ({
          ...c,
          new: c.is_new,
          nextReview: c.next_review_days,
        })));
      } else {
        let query = supabase
          .from('flashy_student_cards')
          .select('*, flashy_deck_assignments!inner(id, is_archived)')
          .eq('student_id', user.id)
          .eq('is_new', false)
          .eq('mastered', false)
          .eq('is_deleted_by_teacher', false)
          .eq('flashy_deck_assignments.is_archived', false)
          .lt('due', new Date().toISOString());
        if (deckId) query = query.eq('assignment_id', deckId);
        const { data: cards } = await query;
        setData((cards || []).map(c => ({
          ...c,
          new: c.is_new,
          nextReview: c.next_review_days,
        })));
      }
    } catch (err) {
      console.error('[useDueCards] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user, useOwnerPath, deckId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/**
 * Fetch new (unlearned) cards — teachers get flashy_cards, students get student_cards.
 * @param {string} [deckId] — if provided, filter to one deck
 */
export const useNewCards = (deckId) => {
  const { user, isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Same logic as useDueCards — own-deck path when deckId is provided
  const useOwnerPath = isTeacher || !!deckId;

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (useOwnerPath) {
        let query = supabase
          .from('flashy_cards')
          .select('*, flashy_decks!inner(owner_id, is_archived)')
          .eq('flashy_decks.owner_id', user.id)
          .eq('flashy_decks.is_archived', false)
          .eq('is_new', true);
        if (deckId) query = query.eq('deck_id', deckId);
        const { data: cards } = await query;
        setData((cards || []).map(c => ({
          ...c,
          new: c.is_new,
          nextReview: c.next_review_days,
        })));
      } else {
        let query = supabase
          .from('flashy_student_cards')
          .select('*, flashy_deck_assignments!inner(id, is_archived)')
          .eq('student_id', user.id)
          .eq('is_new', true)
          .eq('is_deleted_by_teacher', false)
          .eq('flashy_deck_assignments.is_archived', false);
        if (deckId) query = query.eq('assignment_id', deckId);
        const { data: cards } = await query;
        setData((cards || []).map(c => ({
          ...c,
          new: c.is_new,
          nextReview: c.next_review_days,
        })));
      }
    } catch (err) {
      console.error('[useNewCards] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user, useOwnerPath, deckId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Update a card's SRS state — works for both teacher (flashy_cards) and student (flashy_student_cards) */
export const useUpdateStudentCard = () => {
  const { isTeacher } = useAuth();

  const updateStudentCard = async (id, fields) => {
    const table = isTeacher ? 'flashy_cards' : 'flashy_student_cards';
    // Always include last_reviewed_at when updating SRS state
    const payload = { ...fields };
    if (!payload.last_reviewed_at && (payload.is_new === false || payload.reviews != null)) {
      payload.last_reviewed_at = new Date().toISOString();
    }
    try {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        // If the error mentions an unknown column (ease_factor / again_count not yet migrated),
        // retry without those optional columns so the core SRS update still applies.
        const errMsg = String(error.message || '');
        if (/column|ease_factor|again_count/i.test(errMsg)) {
          const fallback = { ...payload };
          delete fallback.ease_factor;
          delete fallback.again_count;
          const { data: d2, error: e2 } = await supabase
            .from(table)
            .update(fallback)
            .eq('id', id)
            .select()
            .single();
          if (!e2) return d2;
        }
        console.warn('[SRS update] Failed:', error.message || JSON.stringify(error));
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[SRS update] Exception:', err?.message || err);
      return null;
    }
  };
  return { updateStudentCard };
};

// ─────────────────────────────────────────────────────
// Assignments
// ─────────────────────────────────────────────────────

/** Fetch all assignments for current user (teacher or student) */
export const useAssignments = () => {
  const { user, isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedAt = useRef(0);
  const isFetchingRef = useRef(false);

  const refetch = useCallback(async ({ background = false } = {}) => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!background) setLoading(true);
    try {
      const col = isTeacher ? 'teacher_id' : 'student_id';
      const { data: assignments } = await supabase
        .from('flashy_deck_assignments')
        .select('*, flashy_decks(name, description, category, tags, difficulty_level)')
        .eq(col, user.id)
        .eq('is_archived', false)
        .order('assigned_at', { ascending: false });
      const nonArchivedAssignments = (assignments || []).filter((item) => item?.is_archived !== true);
      setData(nonArchivedAssignments);
      lastFetchedAt.current = Date.now();
      writeFlashyCache(buildFlashyCacheKey('assignments', user.id, isTeacher ? 'teacher' : 'student'), nonArchivedAssignments);
    } catch (err) {
      console.error('[useAssignments] refetch failed:', err?.message || err);
      if (!background) setData([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, isTeacher]);

  useEffect(() => {
    if (!user) {
      refetch();
      return;
    }
    const cacheKey = buildFlashyCacheKey('assignments', user.id, isTeacher ? 'teacher' : 'student');
    const cachedAssignments = readFlashyCache(cacheKey);
    const normalizedCachedAssignments = Array.isArray(cachedAssignments)
      ? cachedAssignments.filter((item) => item?.is_archived !== true)
      : null;
    const hasCachedAssignments = Array.isArray(normalizedCachedAssignments);
    if (hasCachedAssignments) {
      setData(normalizedCachedAssignments);
      setLoading(false);
      lastFetchedAt.current = Date.now();
    }
    refetch({ background: hasCachedAssignments });
  }, [isTeacher, refetch, user]);

  // Background refresh: 60 s interval + visibility/focus
  useEffect(() => {
    if (!user) return;
    const STALE_MS = 30_000;
    const bgRefetch = () => {
      if (Date.now() - lastFetchedAt.current > STALE_MS) refetch({ background: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') bgRefetch();
    };
    const id = setInterval(bgRefetch, 60_000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', bgRefetch);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', bgRefetch);
    };
  }, [user, refetch]);

  return { data, loading, refetch };
};

/** Assign a deck to a student */
export const useAssignDeck = () => {
  const { user } = useAuth();

  const assignDeck = async (teacherDeckId, studentId, options = {}) => {
    if (!user) throw new Error('Not authenticated');
    const requiredPoolRaw = String(options?.requiredPool || 'any').trim().toLowerCase();
    const allowedPools = new Set(['any', 'new', 'due', 'mixed']);
    const requiredPool = allowedPools.has(requiredPoolRaw) ? requiredPoolRaw : 'any';
    const requiredModeRaw = String(options?.requiredMode || 'any').trim().toLowerCase();
    const allowedModes = new Set(['any', 'flashcards', 'quiz', 'mcq', 'match', 'wheel']);
    const requiredMode = allowedModes.has(requiredModeRaw) ? requiredModeRaw : 'any';
    const payload = {
      p_teacher_deck_id: teacherDeckId,
      p_teacher_id: user.id,
      p_student_ids: [studentId],
      p_sync_enabled: options.syncEnabled ?? true,
      p_custom_name: options.customName ?? '',
      p_study_goal_daily: options.studyGoalDaily ?? 0,
      p_allow_student_cards: options.allowStudentCards ?? true,
      p_allow_student_edit: options.allowStudentEdit ?? true,
      p_group_assignment_id: options.groupAssignmentId ?? null,
      p_required_pool: requiredPool,
      p_required_mode: requiredMode,
      p_add_to_personal_library: options.addToPersonalLibrary ?? options.addToLibrary ?? false,
    };

    let { data: assignmentRows, error } = await supabase.rpc('flashy_bulk_assign_deck', payload);

    const errorText = String(error?.message || error || '');
    const missingSignature = error
      && /Could not find the function public\.flashy_bulk_assign_deck/i.test(errorText);

    if (missingSignature) {
      const legacyPayload = { ...payload };
      delete legacyPayload.p_add_to_personal_library;
      ({ data: assignmentRows, error } = await supabase.rpc('flashy_bulk_assign_deck', legacyPayload));
    }

    if (error) throw error;

    const assignmentId = Array.isArray(assignmentRows)
      ? assignmentRows[0]?.assignment_id
      : assignmentRows?.assignment_id;

    if (!assignmentId) {
      throw new Error('Assignment completed but no assignment id was returned');
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('flashy_deck_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (assignmentError) throw assignmentError;
    return assignment;
  };

  return { assignDeck };
};

// ─────────────────────────────────────────────────────
// Teacher: Students
// ─────────────────────────────────────────────────────

/** Fetch all students belonging to the current teacher */
export const useStudents = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: students } = await supabase
        .from('flashy_profiles')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('role', 'student')
        .order('display_name');
      setData(students || []);
    } catch (err) {
      console.error('[useStudents] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Fetch the latest TutPro roster from the teacher backup snapshot */
export const useTutproRoster = () => {
  const { user, isTeacher } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const refetch = useCallback(async () => {
    if (!user || !isTeacher) {
      setData([]);
      setLastUpdatedAt(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: backupRow, error: backupError } = await supabase
        .from('lesson_manager_backups')
        .select('snapshot, exported_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (backupError) {
        setError(backupError);
        setData([]);
        setLastUpdatedAt(null);
        return;
      }

      setData(backupRow?.snapshot ? extractRosterStudents(backupRow.snapshot) : []);
      setLastUpdatedAt(backupRow?.updated_at || backupRow?.exported_at || null);
      setError(null);
    } catch (err) {
      console.error('[useTutproRoster] refetch failed:', err?.message || err);
      setError(err);
      setData([]);
      setLastUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [user, isTeacher]);

  useEffect(() => { refetch(); }, [refetch]);

  return {
    data,
    loading,
    error,
    lastUpdatedAt,
    refetch,
  };
};

// ─────────────────────────────────────────────────────
// Teacher: Student detail — cards + stats
// ─────────────────────────────────────────────────────

/** Fetch aggregate stats for a student */
export const useStudentStats = (studentId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!studentId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessionsCutoffIso = getStudyCutoffIso();
      const [
        { count: totalCards },
        { count: masteredCards },
        { count: dueCards },
        { count: newCards },
        { data: sessions },
      ] = await Promise.all([
        supabase.from('flashy_student_cards').select('id, flashy_deck_assignments!inner(id)', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('is_deleted_by_teacher', false)
          .eq('flashy_deck_assignments.is_archived', false),
        supabase.from('flashy_student_cards').select('id, flashy_deck_assignments!inner(id)', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('mastered', true).eq('is_deleted_by_teacher', false)
          .eq('flashy_deck_assignments.is_archived', false),
        supabase.from('flashy_student_cards').select('id, flashy_deck_assignments!inner(id)', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('is_new', false).eq('mastered', false)
          .eq('is_deleted_by_teacher', false).lt('due', new Date().toISOString())
          .eq('flashy_deck_assignments.is_archived', false),
        supabase.from('flashy_student_cards').select('id, flashy_deck_assignments!inner(id)', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('is_new', true).eq('is_deleted_by_teacher', false)
          .eq('flashy_deck_assignments.is_archived', false),
        supabase.from('flashy_study_sessions').select('*')
          .eq('student_id', studentId)
          .gte('started_at', sessionsCutoffIso)
          .order('started_at', { ascending: false })
          .limit(50),
      ]);

      setData({
        totalCards: totalCards ?? 0,
        masteredCards: masteredCards ?? 0,
        dueCards: dueCards ?? 0,
        newCards: newCards ?? 0,
        recentSessions: (sessions || []).map(enrichStudySession),
      });
    } catch (err) {
      console.error('[useStudentStats] refetch failed:', err?.message || err);
      setData({
        totalCards: 0,
        masteredCards: 0,
        dueCards: 0,
        newCards: 0,
        recentSessions: [],
      });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Fetch study sessions (kept to last 30 days) for student or teacher context */
export const useStudySessions = ({ studentId = null, assignmentId = null, limit = 100 } = {}) => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ background = false } = {}) => {
    const targetStudentId = String(studentId || user?.id || '');
    if (!targetStudentId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!background) setLoading(true);
    try {
      let query = supabase
        .from('flashy_study_sessions')
        .select('*')
        .eq('student_id', targetStudentId)
        .gte('started_at', getStudyCutoffIso())
        .order('started_at', { ascending: false })
        .limit(Math.max(1, Number(limit) || 100));

      if (assignmentId) {
        query = query.eq('assignment_id', assignmentId);
      }

      const { data: sessions, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      const enrichedSessions = (sessions || []).map(enrichStudySession);
      setData(enrichedSessions);
      setError(null);
      writeFlashyCache(
        buildFlashyCacheKey('study_sessions', targetStudentId, assignmentId || 'all', Math.max(1, Number(limit) || 100)),
        enrichedSessions
      );
    } catch (err) {
      console.error('[useStudySessions] refetch failed:', err?.message || err);
      if (!background) setData([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, limit, studentId, user?.id]);

  useEffect(() => {
    const targetStudentId = String(studentId || user?.id || '');
    if (!targetStudentId) {
      refetch();
      return;
    }
    const normalizedLimit = Math.max(1, Number(limit) || 100);
    const cacheKey = buildFlashyCacheKey('study_sessions', targetStudentId, assignmentId || 'all', normalizedLimit);
    const cachedSessions = readFlashyCache(cacheKey, 2 * 60 * 1000);
    const hasCachedSessions = Array.isArray(cachedSessions);
    if (hasCachedSessions) {
      setData(cachedSessions);
      setError(null);
      setLoading(false);
    }
    refetch({ background: hasCachedSessions });
  }, [assignmentId, limit, refetch, studentId, user?.id]);

  return {
    data,
    loading,
    error,
    refetch,
    retentionDays: STUDY_RETENTION_DAYS,
  };
};

// ─────────────────────────────────────────────────────
// Study sessions
// ─────────────────────────────────────────────────────

/** Record a study session */
export const useRecordSession = () => {
  const { user } = useAuth();

  const recordSession = async (fields) => {
    if (!user) return null;

    const nowIso = new Date().toISOString();
    const startedAt = String(fields?.started_at || nowIso);
    const finishedAt = String(fields?.finished_at || nowIso);
    const startTs = Date.parse(startedAt);
    const finishTs = Date.parse(finishedAt);
    const derivedDuration = Number.isFinite(startTs) && Number.isFinite(finishTs)
      ? Math.max(0, Math.round((finishTs - startTs) / 1000))
      : 0;

    const durationSecondsRaw = Number(fields?.duration_seconds);
    const durationSeconds = Number.isFinite(durationSecondsRaw)
      ? Math.max(0, Math.round(durationSecondsRaw))
      : derivedDuration;

    const cardsStudiedRaw = Number(fields?.cards_studied ?? fields?.reviewed ?? 0);
    const cardsCorrectRaw = Number(fields?.cards_correct ?? fields?.correct_count ?? 0);
    const cardsIncorrectRaw = Number(fields?.cards_incorrect ?? fields?.incorrect_count ?? 0);

    const cardsStudied = Number.isFinite(cardsStudiedRaw) ? Math.max(0, Math.round(cardsStudiedRaw)) : 0;
    const cardsCorrect = Number.isFinite(cardsCorrectRaw) ? Math.max(0, Math.round(cardsCorrectRaw)) : 0;
    const cardsIncorrect = Number.isFinite(cardsIncorrectRaw) ? Math.max(0, Math.round(cardsIncorrectRaw)) : 0;

    const sessionTypeRaw = String(fields?.session_type || fields?.type || '').trim().toLowerCase();
    const allowedSessionTypes = new Set(['learn', 'practice', 'test', 'quick_review']);
    const sessionType = allowedSessionTypes.has(sessionTypeRaw) ? sessionTypeRaw : 'practice';

    const assignmentIdRaw = String(fields?.assignment_id || '').trim();
    const assignmentId = assignmentIdRaw || null;

    const poolRaw = String(fields?.pool || '').trim().toLowerCase();
    const allowedPools = new Set(['new', 'due', 'mixed', 'hard', 'all']);
    const pool = allowedPools.has(poolRaw) ? poolRaw : null;

    const payload = {
      student_id: user.id,
      assignment_id: assignmentId,
      deck_name: String(fields?.deck_name || ''),
      cards_studied: cardsStudied,
      cards_correct: cardsCorrect,
      cards_incorrect: cardsIncorrect,
      session_type: sessionType,
      pool,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: durationSeconds,
    };

    const insertResult = await supabase
      .from('flashy_study_sessions')
      .insert(payload)
      .select()
      .single();

    if (insertResult.error) {
      console.error('[Flashy] Session record error:', insertResult.error.message || insertResult.error);
      return null;
    }

    await supabase
      .from('flashy_study_sessions')
      .delete()
      .eq('student_id', user.id)
      .lt('started_at', getStudyCutoffIso());

    return enrichStudySession(insertResult.data);
  };

  return { recordSession, retentionDays: STUDY_RETENTION_DAYS };
};

/**
 * Signal study completion to the teacher app via student_updates table.
 * This allows auto-marking homework as done WITHOUT requiring the Student App
 * to be open — Flashy writes the signal directly after a study session.
 *
 * Also computes and persists assignment progress (progress_percent, completed)
 * so all three apps can read progress from a single source of truth.
 */
export const useNotifyStudyCompletion = () => {
  const { user, profile } = useAuth();

  const notifyCompletion = async (assignment, sessionPool) => {
    if (!user || !assignment) return;

    const teacherId = String(assignment.teacher_id || '').trim();
    const teacherDeckId = String(assignment.teacher_deck_id || '').trim();
    const assignmentId = String(assignment.id || '').trim();
    if (!teacherId || !teacherDeckId) return;

    // Check if the session matches the required pool (or pool is 'any')
    const requiredPool = String(assignment.required_pool || 'any').trim().toLowerCase();
    const pool = String(sessionPool || '').trim().toLowerCase();
    if (requiredPool !== 'any' && pool && pool !== requiredPool) return;

    // Resolve the TutPro student ID from the profile settings (set by studentAppBridge)
    const settings = (profile && typeof profile.settings === 'object') ? profile.settings : {};
    const tutproStudentId = String(settings.tutproStudentId || '').trim();

    const autoMarkedAt = new Date().toISOString();

    // ── 1. Update assignment progress in flashy_deck_assignments ──
    try {
      const { data: cards } = await supabase
        .from('flashy_student_cards')
        .select('is_new, mastered')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .eq('is_deleted_by_teacher', false);

      const total = (cards || []).length;
      const studied = (cards || []).filter(c => !c.is_new).length;
      const progressPercent = total > 0 ? Math.round((studied / total) * 100) : 0;
      const isCompleted = total > 0 && studied >= total;

      const progressUpdate = {
        progress_percent: progressPercent,
      };
      if (isCompleted) {
        progressUpdate.completed = true;
        progressUpdate.completed_at = autoMarkedAt;
      }

      await supabase
        .from('flashy_deck_assignments')
        .update(progressUpdate)
        .eq('id', assignmentId);
    } catch (progressErr) {
      // Best-effort — columns may not exist yet if migration 015 hasn't run
      console.warn('[Flashy] Assignment progress update failed:', progressErr);
    }

    // ── 2. Send auto-done signal to teacher app via student_updates ──
    try {
      await supabase.from('student_updates').insert({
        student_id: user.id,
        field_name: 'decktrackAutoDone',
        new_value: {
          flashyDeckId: teacherDeckId,
          assignmentId,
          autoMarkedAt,
          feedback: '\u2713 Marked as done automatically',
          // Include the TutPro student ID so the teacher app can match homework
          tutproStudentId: tutproStudentId || undefined,
        },
        timestamp: autoMarkedAt,
        processed: false,
        teacher_id: teacherId,
      });
    } catch (err) {
      // Best-effort — don't block the user if this fails
      console.warn('[Flashy] Auto-complete signal failed:', err);
    }
  };

  return { notifyCompletion };
};

// ─────────────────────────────────────────────────────
// Activity log
// ─────────────────────────────────────────────────────

export const useLogActivity = () => {
  const { user } = useAuth();

  const logActivity = async (action, targetType, targetId, metadata = {}) => {
    if (!user) return;
    await supabase.from('flashy_activity_log').insert({
      actor_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  };

  return { logActivity };
};

/** Fetch recent activity for teacher dashboard */
export const useRecentActivity = (limit = 20) => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: activity } = await supabase
        .from('flashy_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      setData(activity || []);
    } catch (err) {
      console.error('[useRecentActivity] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

// ─────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────

export const useNotifications = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: notifs } = await supabase
        .from('flashy_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      const list = notifs || [];
      setData(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (err) {
      console.error('[useNotifications] refetch failed:', err?.message || err);
      setData([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = async (id) => {
    await supabase.from('flashy_notifications').update({ read: true }).eq('id', id);
    refetch();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('flashy_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    refetch();
  };

  useEffect(() => { refetch(); }, [refetch]);
  return { data, unreadCount, loading, refetch, markRead, markAllRead };
};

// ─────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────

/** Fetch all groups for the current teacher */
export const useGroups = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: groups, error } = await supabase
        .from('flashy_groups')
        .select('*, flashy_group_members(id, student_id)')
        .eq('teacher_id', user.id)
        .order('sort_order')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Groups] fetch error:', error.message);
        setData([]);
        return;
      }

      setData((groups || []).map(g => ({
        ...g,
        memberCount: g.flashy_group_members?.length ?? 0,
        memberIds: (g.flashy_group_members || []).map(m => m.student_id),
      })));
    } catch (err) {
      console.error('[useGroups] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Create a group */
export const useCreateGroup = () => {
  const { user } = useAuth();

  const createGroup = async (fields) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('flashy_groups')
      .insert({ ...fields, teacher_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { createGroup };
};

/** Update a group */
export const useUpdateGroup = () => {
  const updateGroup = async (groupId, fields) => {
    const { data, error } = await supabase
      .from('flashy_groups')
      .update(fields)
      .eq('id', groupId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { updateGroup };
};

/** Delete a group */
export const useDeleteGroup = () => {
  const deleteGroup = async (groupId) => {
    const { error } = await supabase
      .from('flashy_groups')
      .delete()
      .eq('id', groupId);
    if (error) throw error;
  };

  return { deleteGroup };
};

/** Add/remove members from a group */
export const useGroupMembers = () => {
  const addMembers = async (groupId, studentIds) => {
    const rows = studentIds.map(sid => ({ group_id: groupId, student_id: sid }));
    const { error } = await supabase
      .from('flashy_group_members')
      .upsert(rows, { onConflict: 'group_id,student_id', ignoreDuplicates: true });
    if (error) throw error;
  };

  const removeMembers = async (groupId, studentIds) => {
    const { error } = await supabase
      .from('flashy_group_members')
      .delete()
      .eq('group_id', groupId)
      .in('student_id', studentIds);
    if (error) throw error;
  };

  return { addMembers, removeMembers };
};

/** Fetch leaderboard data for all members of a group */
export const useGroupLeaderboard = (groupId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!groupId) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Fetch group members with profile info
      const { data: members } = await supabase
        .from('flashy_group_members')
        .select('student_id, flashy_profiles(id, display_name, email)')
        .eq('group_id', groupId);

      if (!members || members.length === 0) { setData([]); setLoading(false); return; }

      const studentIds = members.map(m => m.student_id);

      // 2. Fetch card stats + session stats in parallel
      const sessionsCutoff = getStudyCutoffIso();
      const [cardsRes, sessionsRes] = await Promise.all([
        supabase.from('flashy_student_cards')
          .select('student_id, mastered, is_new, reviews')
          .in('student_id', studentIds)
          .eq('is_deleted_by_teacher', false),
        supabase.from('flashy_study_sessions')
          .select('student_id, cards_studied, cards_correct, duration_seconds')
          .in('student_id', studentIds)
          .gte('started_at', sessionsCutoff),
      ]);

      // 3. Aggregate per student
      const cardMap = {};
      const sessionMap = {};
      for (const c of (cardsRes.data || [])) {
        if (!cardMap[c.student_id]) cardMap[c.student_id] = { total: 0, mastered: 0, reviews: 0 };
        cardMap[c.student_id].total++;
        if (c.mastered) cardMap[c.student_id].mastered++;
        cardMap[c.student_id].reviews += (c.reviews || 0);
      }
      for (const s of (sessionsRes.data || [])) {
        if (!sessionMap[s.student_id]) sessionMap[s.student_id] = { sessions: 0, studied: 0, correct: 0, time: 0 };
        sessionMap[s.student_id].sessions++;
        sessionMap[s.student_id].studied += (s.cards_studied || 0);
        sessionMap[s.student_id].correct += (s.cards_correct || 0);
        sessionMap[s.student_id].time += (s.duration_seconds || 0);
      }

      const board = members.map(m => {
        const profile = m.flashy_profiles || {};
        const cards = cardMap[m.student_id] || { total: 0, mastered: 0, reviews: 0 };
        const sess = sessionMap[m.student_id] || { sessions: 0, studied: 0, correct: 0, time: 0 };
        const masteryPct = cards.total > 0 ? Math.round((cards.mastered / cards.total) * 100) : 0;
        const accuracy = sess.studied > 0 ? Math.round((sess.correct / sess.studied) * 100) : 0;
        return {
          studentId: m.student_id,
          displayName: profile.display_name || profile.email || 'Unknown',
          totalCards: cards.total,
          mastered: cards.mastered,
          masteryPct,
          reviews: cards.reviews,
          sessions: sess.sessions,
          cardsStudied: sess.studied,
          accuracy,
          studyTimeSec: sess.time,
          score: cards.mastered * 3 + sess.studied + sess.sessions * 2,
        };
      }).sort((a, b) => b.score - a.score);

      setData(board);
    } catch (err) {
      console.error('[useGroupLeaderboard] error:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

// ─────────────────────────────────────────────────────
// Bulk Assignment
// ─────────────────────────────────────────────────────

/** Assign a deck to multiple students at once via server-side RPC */
export const useBulkAssignDeck = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const bulkAssign = async (teacherDeckId, studentIds, options = {}) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const rpcPayload = {
        p_teacher_deck_id: teacherDeckId,
        p_teacher_id: user.id,
        p_student_ids: studentIds,
        p_sync_enabled: options.syncEnabled ?? true,
        p_custom_name: options.customName ?? '',
        p_study_goal_daily: options.studyGoalDaily ?? 0,
        p_allow_student_cards: options.allowStudentCards ?? true,
        p_allow_student_edit: options.allowStudentEdit ?? true,
        p_group_assignment_id: options.groupAssignmentId ?? null,
        p_required_pool: options.requiredPool ?? 'any',
        p_required_mode: options.requiredMode ?? 'any',
        p_add_to_personal_library: options.addToPersonalLibrary ?? options.addToLibrary ?? false,
      };

      let { data, error } = await supabase.rpc('flashy_bulk_assign_deck', rpcPayload);

      const errorText = String(error?.message || error || '');
      const missingSignature = error
        && /Could not find the function public\.flashy_bulk_assign_deck/i.test(errorText);

      if (missingSignature) {
        const legacyPayload = { ...rpcPayload };
        delete legacyPayload.p_required_pool;
        delete legacyPayload.p_required_mode;
        delete legacyPayload.p_add_to_personal_library;
        const legacyResult = await supabase.rpc('flashy_bulk_assign_deck', legacyPayload);
        data = legacyResult?.data;
        error = legacyResult?.error;
      }

      if (error) throw error;
      return data || [];
    } finally {
      setLoading(false);
    }
  };

  return { bulkAssign, loading };
};

// ─────────────────────────────────────────────────────
// Assignment Settings
// ─────────────────────────────────────────────────────

/** Update assignment settings (sync, goals, name, permissions) */
export const useUpdateAssignment = () => {
  const [loading, setLoading] = useState(false);

  const update = async (assignmentId, fields) => {
    const allowed = [
      'sync_enabled', 'custom_name', 'study_goal_daily',
      'allow_student_cards', 'allow_student_edit', 'deadline', 'is_archived',
      'required_pool',
    ];
    const safe = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) safe[key] = fields[key];
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashy_deck_assignments')
        .update(safe)
        .eq('id', assignmentId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { update, updateAssignment: update, loading };
};

/** Unassign (archive) a deck from a student */
export const useUnassignDeck = () => {
  const [loading, setLoading] = useState(false);

  const unassign = async (assignmentId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('flashy_deck_assignments')
        .update({ is_archived: true })
        .eq('id', assignmentId);
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  return { unassign, unassignDeck: unassign, loading };
};

/** Permanently delete a deck assignment and all its student cards */
export const useDeleteAssignment = () => {
  const deleteAssignment = async (assignmentId) => {
    // Student cards cascade-delete via FK
    const { error } = await supabase
      .from('flashy_deck_assignments')
      .delete()
      .eq('id', assignmentId);
    if (error) throw error;
  };

  return { deleteAssignment };
};

/** Teacher deletes a student card (hard delete) */
export const useTeacherDeleteStudentCard = () => {
  const teacherDeleteStudentCard = async (cardId) => {
    const { error } = await supabase
      .from('flashy_student_cards')
      .delete()
      .eq('id', cardId);
    if (error) throw error;
  };

  return { teacherDeleteStudentCard };
};

/** Teacher bulk-deletes multiple student cards */
export const useTeacherBulkDeleteStudentCards = () => {
  const bulkDelete = async (cardIds) => {
    const { error } = await supabase
      .from('flashy_student_cards')
      .delete()
      .in('id', cardIds);
    if (error) throw error;
  };

  return { bulkDelete };
};

/** Teacher resets a student card's SRS progress */
export const useTeacherResetStudentCard = () => {
  const resetCard = async (cardId) => {
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .update({
        is_new: true,
        mastered: false,
        reviews: 0,
        retention: 0,
        due: new Date().toISOString(),
        interval_days: 0,
        ease_factor: 2.5,
        consecutive_correct: 0,
        again_count: 0,
      })
      .eq('id', cardId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { resetCard };
};

// ─────────────────────────────────────────────────────
// Student Custom Cards (student adds cards to assigned decks)
// ─────────────────────────────────────────────────────

/** Create a custom card in an assigned deck */
export const useCreateStudentCard = () => {
  const { user } = useAuth();

  const createStudentCard = async (assignmentId, fields) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .insert({
        assignment_id: assignmentId,
        student_id: user.id,
        is_custom: true,
        source_card_id: null,
        front: fields.front || '',
        back: fields.back || '',
        example_sentence: fields.example_sentence || '',
        pronunciation: fields.pronunciation || '',
        notes: fields.notes || '',
        difficulty: fields.difficulty || 'medium',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { createStudentCard };
};

/** Delete a student's own custom card */
export const useDeleteStudentCard = () => {
  const deleteStudentCard = async (cardId) => {
    const { error } = await supabase
      .from('flashy_student_cards')
      .delete()
      .eq('id', cardId);
    if (error) throw error;
  };

  return { deleteStudentCard };
};

/** Update a student card's content (for edits or personal notes) */
export const useUpdateStudentCardContent = () => {
  const { user } = useAuth();

  const updateContent = async (cardId, fields) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .update(fields)
      .eq('id', cardId)
      .eq('student_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { updateContent };
};

/** Teacher edits a student card's content via assignment ownership */
export const useTeacherUpdateStudentCard = () => {
  const { user } = useAuth();

  const updateCard = async (cardId, fields) => {
    if (!user) throw new Error('Not authenticated');
    const payload = { updated_at: new Date().toISOString() };
    if (fields.front !== undefined) payload.front = fields.front;
    if (fields.back !== undefined) payload.back = fields.back;
    if (fields.example_sentence !== undefined) payload.example_sentence = fields.example_sentence;
    if (fields.notes !== undefined) payload.notes = fields.notes;
    if (fields.pronunciation !== undefined) payload.pronunciation = fields.pronunciation;
    if (fields.image_url !== undefined) payload.image_url = fields.image_url;
    if (fields.difficulty !== undefined) payload.difficulty = fields.difficulty;
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .update(payload)
      .eq('id', cardId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { updateCard };
};

/** Teacher creates a new card in a student's assignment */
export const useTeacherCreateStudentCard = () => {
  const createStudentCard = async (assignmentId, studentId, fields) => {
    const { data, error } = await supabase
      .from('flashy_student_cards')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        front: fields.front || '',
        back: fields.back || '',
        example_sentence: fields.example_sentence || '',
        notes: fields.notes || '',
        is_custom: false,
        is_new: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { createStudentCard };
};

// ─────────────────────────────────────────────────────
// Student Favorites & Notes
// ─────────────────────────────────────────────────────

/** Toggle favorite on a student card */
export const useToggleFavorite = () => {
  const { user } = useAuth();

  const toggleFavorite = async (cardId, currentValue) => {
    if (!user) return;
    const { error } = await supabase
      .from('flashy_student_cards')
      .update({ is_favorite: !currentValue })
      .eq('id', cardId)
      .eq('student_id', user.id);
    if (error) console.error('[Favorite toggle] error:', error.message);
  };

  return { toggleFavorite };
};

/** Fetch all favorites across all assignments */
export const useFavoriteCards = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: cards } = await supabase
        .from('flashy_student_cards')
        .select('*, flashy_deck_assignments!inner(is_archived, flashy_decks(name))')
        .eq('student_id', user.id)
        .eq('is_favorite', true)
        .eq('is_deleted_by_teacher', false)
        .eq('flashy_deck_assignments.is_archived', false)
        .order('updated_at', { ascending: false });
      setData(cards || []);
    } catch (err) {
      console.error('[useFavoriteCards] refetch failed:', err?.message || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

// ─────────────────────────────────────────────────────
// Per-Deck Student Stats
// ─────────────────────────────────────────────────────

/** Fetch card stats per assignment (for dashboard deck cards) */
export const usePerDeckStats = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setData({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: cards } = await supabase
        .from('flashy_student_cards')
        .select('assignment_id, is_new, mastered, due, is_deleted_by_teacher')
        .eq('student_id', user.id)
        .eq('is_deleted_by_teacher', false);

      const byAssignment = {};
      const now = new Date();
      for (const c of cards || []) {
        if (!byAssignment[c.assignment_id]) {
          byAssignment[c.assignment_id] = { total: 0, mastered: 0, due: 0, newCards: 0 };
        }
        const s = byAssignment[c.assignment_id];
        s.total++;
        if (c.mastered) s.mastered++;
        else if (c.is_new) s.newCards++;
        else if (new Date(c.due) < now) s.due++;
      }

      setData(byAssignment);
    } catch (err) {
      console.error('[usePerDeckStats] refetch failed:', err?.message || err);
      setData({});
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
};

/** Update a deck's metadata (name, description, category, etc.) */
export const useUpdateDeck = () => {
  const updateDeck = async (deckId, fields) => {
    const { data, error } = await supabase
      .from('flashy_decks')
      .update(fields)
      .eq('id', deckId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  return { updateDeck };
};

/* ═══════════════════════════════════════ Courses ═══════════════════════════════════════ */

/** Fetch all courses for the current teacher */
export const useCourses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setCourses([]); setLoading(false); return; }
    setLoading(true);
    try {
      const runFetch = ({ includeMembers, includeVisibility }) => supabase
        .from('flashy_courses')
        .select([
          'id, owner_id, name, description, color, icon, sort_order, is_archived, created_at, updated_at',
          'flashy_course_decks(deck_id, sort_order)',
          includeMembers ? 'flashy_course_members(student_id)' : null,
          includeVisibility ? 'flashy_course_student_deck_visibility(student_id, deck_id, is_hidden)' : null,
        ].filter(Boolean).join(', '))
        .eq('owner_id', user.id)
        .eq('is_archived', false)
        .order('sort_order')
        .order('name');

      let { data, error } = await runFetch({ includeMembers: true, includeVisibility: true });
      if (error && /flashy_course_student_deck_visibility/i.test(String(error.message || ''))) {
        ({ data, error } = await runFetch({ includeMembers: true, includeVisibility: false }));
      }
      if (error && /flashy_course_members/i.test(String(error.message || ''))) {
        ({ data, error } = await runFetch({ includeMembers: false, includeVisibility: false }));
      }

      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error('[useCourses]', err);
      setCourses([]);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { courses, loading, refetch };
};

/** CRUD operations for courses */
export const useCourseActions = () => {
  const { user } = useAuth();

  const createCourse = async ({ name, description = '', color = 'blue', icon = 'folder' }) => {
    if (!user) throw new Error('Not signed in');
    const { data, error } = await supabase
      .from('flashy_courses')
      .insert({ owner_id: user.id, name, description, color, icon })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const updateCourse = async (courseId, fields) => {
    const { data, error } = await supabase
      .from('flashy_courses')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', courseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const deleteCourse = async (courseId) => {
    const { error } = await supabase
      .from('flashy_courses')
      .delete()
      .eq('id', courseId);
    if (error) throw error;
  };

  const addDeckToCourse = async (courseId, deckId) => {
    const { error } = await supabase
      .from('flashy_course_decks')
      .upsert({ course_id: courseId, deck_id: deckId }, { onConflict: 'course_id,deck_id' });
    if (error) throw error;
  };

  const removeDeckFromCourse = async (courseId, deckId) => {
    const { error } = await supabase
      .from('flashy_course_decks')
      .delete()
      .eq('course_id', courseId)
      .eq('deck_id', deckId);
    if (error) throw error;
  };

  const addStudentsToCourse = async (courseId, studentIds = []) => {
    if (!user) throw new Error('Not signed in');

    const normalizedIds = [...new Set(
      (studentIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    )];
    if (!normalizedIds.length) return;

    const rows = normalizedIds.map((studentId) => ({
      course_id: courseId,
      student_id: studentId,
      invited_by: user.id,
    }));

    const { error } = await supabase
      .from('flashy_course_members')
      .upsert(rows, { onConflict: 'course_id,student_id', ignoreDuplicates: true });

    if (error) throw error;
  };

  const removeStudentsFromCourse = async (courseId, studentIds = []) => {
    if (!user) throw new Error('Not signed in');

    const normalizedIds = [...new Set(
      (studentIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    )];
    if (!normalizedIds.length) return;

    const { error } = await supabase
      .from('flashy_course_members')
      .delete()
      .eq('course_id', courseId)
      .in('student_id', normalizedIds);

    if (error) throw error;
  };

  const setStudentCourseDeckVisibility = async ({ courseId, studentId, deckIds = [], isHidden = true }) => {
    if (!user) throw new Error('Not signed in');

    const normalizedDeckIds = [...new Set(
      (deckIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    )];

    if (!courseId || !studentId || normalizedDeckIds.length === 0) return;

    const rows = normalizedDeckIds.map((deckId) => ({
      course_id: courseId,
      student_id: studentId,
      deck_id: deckId,
      is_hidden: Boolean(isHidden),
    }));

    const { error } = await supabase
      .from('flashy_course_student_deck_visibility')
      .upsert(rows, { onConflict: 'course_id,student_id,deck_id' });

    if (error) throw error;
  };

  const clearStudentCourseDeckVisibility = async ({ courseId, studentId, deckIds = [] }) => {
    if (!user) throw new Error('Not signed in');

    const normalizedDeckIds = [...new Set(
      (deckIds || []).map((id) => String(id || '').trim()).filter(Boolean)
    )];

    if (!courseId || !studentId || normalizedDeckIds.length === 0) return;

    const { error } = await supabase
      .from('flashy_course_student_deck_visibility')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .in('deck_id', normalizedDeckIds);

    if (error) throw error;
  };

  return {
    createCourse,
    updateCourse,
    deleteCourse,
    addDeckToCourse,
    removeDeckFromCourse,
    addStudentsToCourse,
    removeStudentsFromCourse,
    setStudentCourseDeckVisibility,
    clearStudentCourseDeckVisibility,
  };
};

/**
 * Fetch courses explicitly assigned to a student.
 * Includes course decks and course members for in-course roster display.
 * Implements defensive querying with fallbacks for RLS policy issues.
 */
export const useStudentCourses = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!user) { 
      console.log('[useStudentCourses] No user, clearing courses');
      setCourses([]); 
      setLoading(false); 
      return; 
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const userId = String(user.id || '').trim();
      console.log('[useStudentCourses] Starting fetch for user:', userId);
      
      const baseSelect = 'id, name, description, color, icon, sort_order, owner_id, flashy_course_decks(deck_id, sort_order, flashy_decks(id, name, description, category)), flashy_course_members(student_id, flashy_profiles(id, display_name, email, role))';
      
      // ATTEMPT 1: Full query with visibility table
      console.log('[useStudentCourses] Attempting query with visibility table...');
      let { data, error } = await supabase
        .from('flashy_courses')
        .select(`${baseSelect}, flashy_course_student_deck_visibility(student_id, deck_id, is_hidden)`)
        .eq('is_archived', false)
        .order('sort_order')
        .order('name');

      if (error) {
        console.warn('[useStudentCourses] Visibility query failed:', error.message);
        
        // ATTEMPT 2: Query without visibility table (RLS may block it)
        console.log('[useStudentCourses] Attempting query without visibility table...');
        ({ data, error } = await supabase
          .from('flashy_courses')
          .select(baseSelect)
          .eq('is_archived', false)
          .order('sort_order')
          .order('name'));
        
        if (error) {
          console.error('[useStudentCourses] Base query also failed:', error.message);
          throw error;
        }
      }

      console.log('[useStudentCourses] Query returned courses:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('[useStudentCourses] No courses found in database');
        setCourses([]);
        return;
      }

      // Filter courses where current student is a member
      const studentCourses = data.filter((course) => {
        const members = course.flashy_course_members || [];
        const isMember = members.some((m) => String(m.student_id || '').trim() === userId);
        if (!isMember) {
          console.log('[useStudentCourses] Filtering out course (not a member):', course.id, course.name);
        }
        return isMember;
      });

      console.log('[useStudentCourses] Courses after membership filter:', studentCourses.length);

      // Process visibility and decks
      const filteredCourses = studentCourses.map((course) => {
        const hiddenDeckIds = new Set(
          (course.flashy_course_student_deck_visibility || [])
            .filter((row) => String(row.student_id || '').trim() === userId && row.is_hidden === true)
            .map((row) => String(row.deck_id || '').trim())
            .filter(Boolean)
        );

        const visibleDecks = (course.flashy_course_decks || []).filter((entry) => {
          const deckId = String(entry.deck_id || entry.flashy_decks?.id || '').trim();
          return deckId && !hiddenDeckIds.has(deckId);
        });

        return {
          ...course,
          flashy_course_decks: visibleDecks,
        };
      });

      console.log('[useStudentCourses] Final filtered courses:', filteredCourses.length);
      setCourses(filteredCourses);
    } catch (err) {
      const errorMsg = err?.message || String(err);
      console.error('[useStudentCourses] Fatal error:', errorMsg);
      setError(errorMsg);
      setCourses([]);
    } finally { 
      setLoading(false); 
    }
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { courses, loading, error, refetch };
};

/**
 * Fetch students that share the same teacher (course "members").
 * Returns profiles with teacher_id matching the current student's teacher_id.
 */
export const useCoursePeers = () => {
  const { user, profile } = useAuth();
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);

  const teacherId = profile?.teacher_id;

  const refetch = useCallback(async () => {
    if (!user || !teacherId) { setPeers([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashy_profiles')
        .select('id, display_name, email, role')
        .eq('teacher_id', teacherId)
        .eq('role', 'student');
      if (error) throw error;
      setPeers(data || []);
    } catch (err) {
      console.error('[useCoursePeers]', err);
      setPeers([]);
    } finally { setLoading(false); }
  }, [user, teacherId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { peers, loading, refetch };
};
