/**
 * Study session local persistence.
 *
 * Saves/restores study session state per deck so users can resume
 * an unfinished session after navigating away or closing the tab.
 *
 * Storage key: flashy.session.<deckId>
 *
 * Session shape:
 *   deckId          – deck identifier
 *   pool            – card pool used (new/due/mixed/hard/all)
 *   mode            – study mode (flashcards/mcq/fillblank/match/quiz)
 *   sideOrder       – term / def / mixed
 *   shuffle         – boolean
 *   cardOrder       – array of card IDs in study order
 *   completedIds    – array of card IDs already graded
 *   currentIndex    – index of current card in cardOrder
 *   reviewIds       – card IDs marked "again" (for review)
 *   startedAt       – ISO timestamp of session start
 *   updatedAt       – ISO timestamp of last update
 *   stats           – { reviewed, again, hard, good, easy }
 */

import { STORAGE_KEYS } from './storageKeys';

const KEY_PREFIX = STORAGE_KEYS.sessionPrefix;

const getKey = (deckId) => `${KEY_PREFIX}${deckId}`;

/** Get saved session for a deck, or null if none / expired */
export const getStudySession = (deckId) => {
  if (!deckId) return null;
  try {
    const raw = localStorage.getItem(getKey(deckId));
    if (!raw) return null;
    const session = JSON.parse(raw);

    // Expire sessions older than 24h
    if (session.updatedAt && Date.now() - new Date(session.updatedAt).getTime() > 24 * 60 * 60 * 1000) {
      clearStudySession(deckId);
      return null;
    }

    return session;
  } catch {
    return null;
  }
};

/** Save / update a study session */
export const saveStudySession = (deckId, sessionData) => {
  if (!deckId) return;
  try {
    localStorage.setItem(getKey(deckId), JSON.stringify({
      ...sessionData,
      deckId,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // Storage full or unavailable
  }
};

/** Remove a study session */
export const clearStudySession = (deckId) => {
  if (!deckId) return;
  try {
    localStorage.removeItem(getKey(deckId));
  } catch {}
};

/** Get progress percentage (0-100) for a deck, or null if no session */
export const getSessionProgress = (deckId) => {
  const session = getStudySession(deckId);
  if (!session || !session.cardOrder || session.cardOrder.length === 0) return null;
  const total = session.cardOrder.length;
  const done = session.completedIds?.length || 0;
  return Math.round((done / total) * 100);
};

/** Get all active session deck IDs */
export const getActiveSessionDeckIds = () => {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        const deckId = key.slice(KEY_PREFIX.length);
        const session = getStudySession(deckId);
        if (session) ids.push(deckId);
      }
    }
  } catch {}
  return ids;
};

const studySessionLib = {
  getStudySession,
  saveStudySession,
  clearStudySession,
  getSessionProgress,
  getActiveSessionDeckIds,
};

export default studySessionLib;
