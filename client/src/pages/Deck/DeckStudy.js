import { useParams, useNavigate } from "react-router";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import StudySetup from "../../modules/StudySetup";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import FillBlank from "../../modules/FillBlank";
import MultipleChoice from "../../modules/MultipleChoice";
import MatchGame from "../../modules/MatchGame";
import SpinWheel from "../../modules/SpinWheel";
import MixedMode from "../../modules/MixedMode";
import TrueFalse from "../../modules/TrueFalse";
import { useDeck, useNewCards, useDueCards, useRecordSession } from "../../hooks/useSupabaseData";
import { getStudySession, saveStudySession, clearStudySession } from "../../lib/studySession";

const DEFAULT_SESSION_STATS = {
  reviewed: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
  correct: 0,
  incorrect: 0,
};

const shuffleCards = (cards) => [...cards].sort(() => Math.random() - 0.5);

const resolveShowTermFirst = (sideOrder) => {
  if (sideOrder === "def") return false;
  if (sideOrder === "mixed") return Math.random() > 0.5;
  return true;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getLegacyProgressIndex = (session) => {
  if (typeof session?.currentIndex === "number" && session.currentIndex >= 0) {
    return session.currentIndex;
  }
  if (Array.isArray(session?.completedIds)) {
    return session.completedIds.length;
  }
  return 0;
};

const getLegacyStartedAt = (session) => {
  const startedIso = session?.startedAt || new Date().toISOString();
  const startedMs = new Date(startedIso).getTime();
  return {
    iso: startedIso,
    ts: Number.isFinite(startedMs) ? startedMs : Date.now(),
  };
};

const buildLegacyModeState = (session) => {
  if (!session || session.modeState) return session?.modeState || null;

  const cardOrder = Array.isArray(session.cardOrder) ? session.cardOrder : [];
  const completedIds = Array.isArray(session.completedIds) ? session.completedIds : [];
  const currentIndex = Math.max(0, getLegacyProgressIndex(session));
  const { iso: sessionStartedAtIso, ts: sessionStartedAtTs } = getLegacyStartedAt(session);
  const stats = session.stats || {};
  const fallbackStats = {
    reviewed: toNumber(stats.reviewed, completedIds.length),
    again: toNumber(stats.again, 0),
    hard: toNumber(stats.hard, 0),
    good: toNumber(stats.good, 0),
    easy: toNumber(stats.easy, 0),
  };

  switch (session.mode) {
    case "flashcards":
      return {
        queueIds: cardOrder,
        position: Math.min(currentIndex, Math.max(0, cardOrder.length - 1)),
        isFlipped: false,
        sessionStats: fallbackStats,
        cardResults: session.cardResults || {},
        sessionStartedAt: sessionStartedAtTs,
      };
    case "mcq":
      return {
        current: currentIndex,
        selected: null,
        correctCount: toNumber(stats.correct, 0),
        cardResults: session.cardResults || {},
        sessionStartedAt: sessionStartedAtIso,
      };
    case "fillblank":
    case "quiz":
      return {
        current: currentIndex,
        answer: "",
        status: null,
        correctCount: toNumber(stats.correct, 0),
        cardResults: session.cardResults || {},
        sessionStartedAt: sessionStartedAtIso,
      };
    case "truefalse":
      return {
        current: currentIndex,
        answered: null,
        correctCount: toNumber(stats.correct, 0),
        cardResults: session.cardResults || {},
        sessionStartedAt: sessionStartedAtIso,
      };
    case "mixedmode":
      return {
        current: currentIndex,
        answered: false,
        correctCount: toNumber(stats.correct, 0),
        lastCorrect: null,
        mcqSelected: null,
        tfChoice: null,
        fillValue: "",
        fillChecked: false,
        sessionStartedAt: sessionStartedAtIso,
      };
    case "match": {
      const batchSize = 6;
      const batchIndex = Math.floor(completedIds.length / batchSize);
      const batchStart = batchIndex * batchSize;
      const inProgressMatchedIds = cardOrder.slice(batchStart, completedIds.length);
      return {
        batchIndex,
        selectedTerm: null,
        matchedIds: inProgressMatchedIds,
        wrongPair: null,
        totalMatched: completedIds.length,
        startTime: sessionStartedAtTs,
        elapsed: 0,
        missCount: {},
        definitionOrder: [],
        sessionStartedAt: sessionStartedAtIso,
      };
    }
    case "wheel":
      return {
        selectedCardId: null,
        flipped: false,
        rotation: 0,
        showCard: false,
        removedIds: completedIds,
        continued: Math.max(0, toNumber(stats.reviewed, completedIds.length) - completedIds.length),
        winningSegIdx: null,
        cardShownAt: null,
        sessionStartedAt: sessionStartedAtIso,
      };
    default:
      return null;
  }
};

/**
 * Unified study page for a deck.
 * Shows a setup screen first, then launches the chosen study mode.
 * Persists session state to localStorage so users can resume.
 * If a saved session exists, offers to continue or start new.
 *
 * Route: /deck/:id/study
 */
const DeckStudy = () => {
  const params = useParams();
  const navigate = useNavigate();
  const deckId = params.id;
  const { data: deck, loading: deckLoading } = useDeck(deckId);
  const { data: newCards, loading: newLoading } = useNewCards(deckId);
  const { data: dueCards, loading: dueLoading } = useDueCards(deckId);
  const { recordSession } = useRecordSession();

  const [config, setConfig] = useState(null);
  const configRef = useRef(config);
  // "choose" = show resume/new choice, null = no saved session
  const [resumeChoice, setResumeChoice] = useState(null);

  const loading = deckLoading || newLoading || dueLoading;

  const allCards = useMemo(() => deck?.flashcards || [], [deck]);
  const hardCards = useMemo(() => {
    return allCards.filter(c => (c.again_count || 0) >= 3 || (c.ease_factor && c.ease_factor < 2.0));
  }, [allCards]);

  const getCardsForPool = useCallback((pool) => {
    switch (pool) {
      case "new":
        return newCards || [];
      case "due":
        return dueCards || [];
      case "mixed":
        return [...(newCards || []), ...(dueCards || [])];
      case "hard":
        return hardCards;
      case "all":
        return allCards;
      default:
        return newCards || [];
    }
  }, [allCards, dueCards, hardCards, newCards]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Check for existing session on mount
  useEffect(() => {
    if (loading || config) return;
    const saved = getStudySession(deckId);
    if (saved && saved.pool && saved.mode) {
      // Show choice to resume or start new
      setResumeChoice(saved);
    }
  }, [loading, config, deckId]);

  // Resume saved session
  const handleResume = useCallback(() => {
    if (resumeChoice) {
      setConfig(resumeChoice);
      setResumeChoice(null);
    }
  }, [resumeChoice]);

  // Discard saved session and show setup
  const handleStartNew = useCallback(() => {
    clearStudySession(deckId);
    setResumeChoice(null);
    setConfig(null);
  }, [deckId]);

  // Start a fresh session from setup
  const handleStart = useCallback((cfg) => {
    const poolCards = getCardsForPool(cfg.pool);
    const orderedCards = cfg.shuffle ? shuffleCards(poolCards) : [...poolCards];
    const session = {
      ...cfg,
      showTermFirst: resolveShowTermFirst(cfg.sideOrder),
      startedAt: new Date().toISOString(),
      cardOrder: orderedCards.map((card) => card.id),
      completedIds: [],
      currentIndex: 0,
      stats: { ...DEFAULT_SESSION_STATS },
      cardResults: {},
      modeState: null,
    };
    saveStudySession(deckId, session);
    setConfig(session);
  }, [deckId, getCardsForPool]);

  const handleModeStateChange = useCallback((patch) => {
    if (!patch || typeof patch !== "object") return;
    const session = getStudySession(deckId) || configRef.current;
    if (!session) return;
    const nextSession = { ...session, ...patch };
    saveStudySession(deckId, nextSession);
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, [deckId]);

  // Called when session is complete — keep session data for results, mark as done
  const handleComplete = useCallback(() => {
    const session = getStudySession(deckId) || config;
    if (session) {
      saveStudySession(deckId, { ...session, finished: true });
    }
    setTimeout(() => clearStudySession(deckId), 2000);
  }, [config, deckId]);

  const handleRecordSession = useCallback(async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: null,
      deck_name: deck?.name || 'Deck Study',
    });
  }, [deck?.name, recordSession]);

  const handleModeSessionComplete = useCallback(async (summary) => {
    await handleRecordSession(summary);
    handleComplete();
  }, [handleComplete, handleRecordSession]);

  // Quit: save progress and navigate back to deck
  const handleQuit = useCallback(() => {
    navigate(`/deck/${deckId}`);
  }, [navigate, deckId]);

  const poolCards = useMemo(
    () => (config ? getCardsForPool(config.pool) : []),
    [config, getCardsForPool]
  );
  const cardsById = useMemo(
    () => new Map(poolCards.map((card) => [String(card.id), card])),
    [poolCards]
  );
  const resolvedModeState = useMemo(
    () => (config ? buildLegacyModeState(config) : null),
    [config]
  );

  if (loading) return <LoadingScreen />;
  if (!deck) {
    navigate("/");
    return null;
  }

  // Resume / Start New choice
  if (resumeChoice && !config) {
    const pct = resumeChoice.completedIds?.length && resumeChoice.cardOrder?.length
      ? Math.round((resumeChoice.completedIds.length / resumeChoice.cardOrder.length) * 100)
      : resumeChoice.stats?.reviewed || 0;
    return (
      <div style={{ maxWidth: 420, margin: '3rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Unfinished Study Session</h2>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {resumeChoice.pool} · {resumeChoice.mode} · {pct > 0 ? `${pct}% done` : `${resumeChoice.stats?.reviewed || 0} cards reviewed`}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={handleResume}
            style={{
              padding: '0.6rem 1.5rem', border: '1.5px solid var(--fg)', borderRadius: 'var(--radius)',
              background: 'var(--fg)', color: 'var(--bg)', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Continue
          </button>
          <button
            onClick={handleStartNew}
            style={{
              padding: '0.6rem 1.5rem', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius)',
              background: 'transparent', color: 'var(--fg)', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Start New
          </button>
        </div>
      </div>
    );
  }

  // Setup screen
  if (!config) {
    return (
      <StudySetup
        newCount={(newCards || []).length}
        dueCount={(dueCards || []).length}
        hardCount={hardCards.length}
        totalCount={allCards.length}
        onStart={handleStart}
      />
    );
  }

  let cards = Array.isArray(config.cardOrder) && config.cardOrder.length > 0
    ? config.cardOrder.map((cardId) => cardsById.get(String(cardId))).filter(Boolean)
    : poolCards;

  if (cards.length === 0) {
    cards = poolCards;
  }

  const showTermFirst = typeof config.showTermFirst === "boolean"
    ? config.showTermFirst
    : resolveShowTermFirst(config.sideOrder);

  // Common props for all modules
  const sharedProps = { onQuit: handleQuit };
  const sharedSessionProps = {
    sessionState: resolvedModeState,
    onStateChange: handleModeStateChange,
  };

  // Render appropriate study mode
  switch (config.mode) {
    case "mcq":
      return <MultipleChoice flashcards={cards} showTermFirst={showTermFirst} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "fillblank":
      return <FillBlank flashcards={cards} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "match":
      return <MatchGame flashcards={cards} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "quiz":
      return <FillBlank flashcards={cards} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "wheel":
      return <SpinWheel flashcards={cards} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "mixedmode":
      return <MixedMode flashcards={cards} showTermFirst={showTermFirst} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "truefalse":
      return <TrueFalse flashcards={cards} onSessionComplete={handleModeSessionComplete} {...sharedSessionProps} {...sharedProps} />;
    case "flashcards":
    default:
      // For new cards use Learn, for due/mixed/hard/all use Practice
      if (config.pool === "new") {
        return <Learn flashcards={cards} showTermFirst={showTermFirst} onComplete={handleComplete} onSessionComplete={handleRecordSession} {...sharedSessionProps} {...sharedProps} />;
      }
      return <Practice flashcards={cards} showTermFirst={showTermFirst} onComplete={handleComplete} onSessionComplete={handleRecordSession} {...sharedSessionProps} {...sharedProps} />;
  }
};

export default DeckStudy;
