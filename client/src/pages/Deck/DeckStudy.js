import { useParams, useNavigate } from "react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import StudySetup from "../../modules/StudySetup";
import Learn from "../../modules/Learn";
import Practice from "../../modules/Practice";
import FillBlank from "../../modules/FillBlank";
import MultipleChoice from "../../modules/MultipleChoice";
import MatchGame from "../../modules/MatchGame";
import { useDeck, useNewCards, useDueCards } from "../../hooks/useSupabaseData";
import { getStudySession, saveStudySession, clearStudySession } from "../../lib/studySession";

/**
 * Unified study page for a deck.
 * Shows a setup screen first, then launches the chosen study mode.
 * Persists session state to localStorage so users can resume.
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

  const [config, setConfig] = useState(null);

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
      setConfig(saved);
    }
  }, [loading, config, deckId]);

  // Save session whenever config changes
  const handleStart = useCallback((cfg) => {
    const session = {
      ...cfg,
      startedAt: new Date().toISOString(),
      completedIds: [],
      currentIndex: 0,
      stats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
    };
    saveStudySession(deckId, session);
    setConfig(session);
  }, [deckId]);

  // Called by study modules when a card is graded
  const handleProgress = useCallback((cardId, grade, position, total) => {
    const session = getStudySession(deckId);
    if (!session) return;
    const completedIds = [...new Set([...(session.completedIds || []), cardId])];
    const stats = { ...(session.stats || {}), reviewed: (session.stats?.reviewed || 0) + 1 };
    if (grade) stats[grade] = (stats[grade] || 0) + 1;
    saveStudySession(deckId, { ...session, completedIds, currentIndex: position, stats });
  }, [deckId]);

  // Called when session is complete
  const handleComplete = useCallback(() => {
    clearStudySession(deckId);
  }, [deckId]);

  if (loading) return <LoadingScreen />;
  if (!deck) {
    navigate("/");
    return null;
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

  // Render appropriate study mode
  switch (config.mode) {
    case "mcq":
      return <MultipleChoice flashcards={cards} showTermFirst={showTermFirst} />;
    case "fillblank":
      return <FillBlank flashcards={cards} />;
    case "match":
      return <MatchGame flashcards={cards} />;
    case "quiz":
      return <FillBlank flashcards={cards} />;
    case "flashcards":
    default:
      // For new cards use Learn, for due/mixed/hard/all use Practice
      if (config.pool === "new") {
        return <Learn flashcards={cards} showTermFirst={showTermFirst} onProgress={handleProgress} onComplete={handleComplete} />;
      }
      return <Practice flashcards={cards} showTermFirst={showTermFirst} onProgress={handleProgress} onComplete={handleComplete} />;
  }
};

export default DeckStudy;
