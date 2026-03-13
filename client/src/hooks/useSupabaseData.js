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
    if (error) throw new Error(error.message || 'Failed to create card');
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

        if (error) throw new Error(error.message || 'Failed to create cards');
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
    if (error) throw new Error(error.message || 'Failed to update card');
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
    try {
      const { data, error } = await supabase
        .from(table)
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.warn('[SRS update] Failed:', error.message || JSON.stringify(error));
        // Don't throw — SRS update failures shouldn't crash the UI
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

  const assignDeck = async (teacherDeckId, studentId) => {
    if (!user) throw new Error('Not authenticated');
    // Create assignment
    const { data: assignment, error: aErr } = await supabase
      .from('flashy_deck_assignments')
      .insert({
        teacher_deck_id: teacherDeckId,
        student_id: studentId,
        teacher_id: user.id,
      })
      .select()
      .single();
    if (aErr) throw aErr;

    // Copy all cards from the master deck to student cards
    const { data: masterCards } = await supabase
      .from('flashy_cards')
      .select('*')
      .eq('deck_id', teacherDeckId)
      .order('sort_order');

    if (masterCards && masterCards.length > 0) {
      const studentCards = masterCards.map(c => ({
        assignment_id: assignment.id,
        source_card_id: c.id,
        student_id: studentId,
        front: c.front,
        back: c.back,
        example_sentence: c.example_sentence,
        pronunciation: c.pronunciation,
        part_of_speech: c.part_of_speech,
        image_url: c.image_url,
        notes: c.notes,
        difficulty: c.difficulty,
        sort_order: c.sort_order,
      }));
      const { error: cErr } = await supabase
        .from('flashy_student_cards')
        .insert(studentCards);
      if (cErr) throw cErr;
    }

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

    const payload = {
      student_id: user.id,
      assignment_id: assignmentId,
      deck_name: String(fields?.deck_name || ''),
      cards_studied: cardsStudied,
      cards_correct: cardsCorrect,
      cards_incorrect: cardsIncorrect,
      session_type: sessionType,
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
      const { data, error } = await supabase.rpc('flashy_bulk_assign_deck', {
        p_teacher_deck_id: teacherDeckId,
        p_teacher_id: user.id,
        p_student_ids: studentIds,
        p_sync_enabled: options.syncEnabled ?? true,
        p_custom_name: options.customName ?? '',
        p_study_goal_daily: options.studyGoalDaily ?? 0,
        p_allow_student_cards: options.allowStudentCards ?? true,
        p_allow_student_edit: options.allowStudentEdit ?? true,
        p_group_assignment_id: options.groupAssignmentId ?? null,
      });
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
