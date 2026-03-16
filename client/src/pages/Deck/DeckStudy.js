import { useParams, useNavigate } from "react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
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
  // "choose" = show resume/new choice, null = no saved session
  const [resumeChoice, setResumeChoice] = useState(null);

  const loading = deckLoading || newLoading || dueLoading;

  const allCards = useMemo(() => deck?.flashcards || [], [deck]);
  const hardCards = useMemo(() => {
    return allCards.filter(c => (c.again_count || 0) >= 3 || (c.ease_factor && c.ease_factor < 2.0));
  }, [allCards]);

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
    const session = {
      ...cfg,
      startedAt: new Date().toISOString(),
      completedIds: [],
      currentIndex: 0,
      stats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
      cardResults: {},
    };
    saveStudySession(deckId, session);
    setConfig(session);
  }, [deckId]);

  // Called by study modules when a card is graded
  const handleProgress = useCallback((cardId, grade, position, total, cardFront, cardBack) => {
    const session = getStudySession(deckId);
    if (!session) return;
    const completedIds = [...new Set([...(session.completedIds || []), cardId])];
    const stats = { ...(session.stats || {}), reviewed: (session.stats?.reviewed || 0) + 1 };
    if (grade) stats[grade] = (stats[grade] || 0) + 1;

    // Track per-card results for hardness detection
    const cardResults = { ...(session.cardResults || {}) };
    if (!cardResults[cardId]) {
      cardResults[cardId] = { front: cardFront || '', back: cardBack || '', grades: [], attempts: 0 };
    }
    cardResults[cardId].grades.push(grade);
    cardResults[cardId].attempts += 1;

    saveStudySession(deckId, { ...session, completedIds, currentIndex: position, stats, cardResults });
  }, [deckId]);

  // Called when session is complete — keep session data for results, mark as done
  const handleComplete = useCallback(() => {
    // Don't clear immediately — results screen will read it
    // Just mark updatedAt so sidebar stops showing it
    const session = getStudySession(deckId);
    if (session) {
      saveStudySession(deckId, { ...session, finished: true });
    }
    // Clear after a short delay to allow results screen to read data
    setTimeout(() => clearStudySession(deckId), 2000);
  }, [deckId]);

  const handleSessionComplete = useCallback(async (summary) => {
    await recordSession({
      ...summary,
      assignment_id: null,
      deck_name: deck?.name || 'Deck Study',
    });
  }, [deck?.name, recordSession]);

  // Quit: save progress and navigate back to deck
  const handleQuit = useCallback(() => {
    navigate(`/deck/${deckId}`);
  }, [navigate, deckId]);

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

  // Determine card pool
  let cards = [];
  switch (config.pool) {
    case "new": cards = newCards || []; break;
    case "due": cards = dueCards || []; break;
    case "mixed": cards = [...(newCards || []), ...(dueCards || [])]; break;
    case "hard": cards = hardCards; break;
    case "all": cards = allCards; break;
    default: cards = newCards || [];
  }

  // Shuffle if requested (only on first start, not resume)
  if (config.shuffle && !config.completedIds?.length) {
    cards = [...cards].sort(() => Math.random() - 0.5);
  }

  // Determine showTermFirst from side order
  const getShowTermFirst = () => {
    if (config.sideOrder === "def") return false;
    if (config.sideOrder === "mixed") return Math.random() > 0.5;
    return true; // "term"
  };

  const showTermFirst = getShowTermFirst();

  // Common props for all modules
  const sharedProps = { onQuit: handleQuit };

  // Render appropriate study mode
  switch (config.mode) {
    case "mcq":
      return <MultipleChoice flashcards={cards} showTermFirst={showTermFirst} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "fillblank":
      return <FillBlank flashcards={cards} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "match":
      return <MatchGame flashcards={cards} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "quiz":
      return <FillBlank flashcards={cards} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "wheel":
      return <SpinWheel flashcards={cards} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "mixedmode":
      return <MixedMode flashcards={cards} showTermFirst={showTermFirst} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "truefalse":
      return <TrueFalse flashcards={cards} onSessionComplete={handleSessionComplete} {...sharedProps} />;
    case "flashcards":
    default:
      // For new cards use Learn, for due/mixed/hard/all use Practice
      if (config.pool === "new") {
        return <Learn flashcards={cards} showTermFirst={showTermFirst} onProgress={handleProgress} onComplete={handleComplete} onSessionComplete={handleSessionComplete} {...sharedProps} />;
      }
      return <Practice flashcards={cards} showTermFirst={showTermFirst} onProgress={handleProgress} onComplete={handleComplete} onSessionComplete={handleSessionComplete} {...sharedProps} />;
  }
};

export default DeckStudy;
