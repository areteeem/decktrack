import ProgressBar from "../../common/components/ProgressBar";
import styles from "./Learn.module.css";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";
import FlipCard from "../../common/components/FlipCard";
import { useUpdateStudentCard } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import { tick as timerTick, stop as timerStop } from "../../lib/studyTimer";

/**
 * SM-2 inspired interval calculations for Learn (new cards).
 * Again = re-queue in session, 1 min interval
 * Hard  = 6 min / 1 day
 * Good  = 10 min / 1 day
 * Easy  = 3 days
 */
const GRADES = {
  again: { label: "Again", key: "1", interval: 0, requeue: true },
  hard:  { label: "Hard",  key: "2", interval: 1 },
  good:  { label: "Good",  key: "3", interval: 1 },
  easy:  { label: "Easy",  key: "4", interval: 3 },
};

/** Format interval days into a human-readable string */
const formatInterval = (days, t) => {
  if (days <= 0) return t("lessThan1m");
  if (days < 1) {
    const mins = Math.round(days * 24 * 60);
    if (mins < 60) return t("minutes", { n: mins });
    return t("hours", { n: Math.round(mins / 60) });
  }
  if (days >= 30) return t("months", { n: Math.round(days / 30) });
  return t("days", { n: days });
};

/** Compute hardness score: higher = harder for the student */
const computeHardness = (cardResult) => {
  if (!cardResult || !cardResult.grades.length) return 0;
  let score = 0;
  for (const g of cardResult.grades) {
    if (g === 'again') score += 3;
    else if (g === 'hard') score += 1.5;
    else if (g === 'good') score += 0;
    else if (g === 'easy') score -= 1;
  }
  // Bonus for many attempts (re-queued cards)
  score += Math.max(0, cardResult.attempts - 1) * 0.5;
  return score;
};

const Learn = ({ flashcards, showTermFirst = true, onComplete, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const { updateStudentCard } = useUpdateStudentCard();
  const { srsMode, t } = useSettings();
  const initialQueueIds = useMemo(() => {
    if (!flashcards) return [];
    return flashcards.map((card) => card.id);
  }, [flashcards]);
  const restoredStateRef = useRef({
    queueIds: Array.isArray(sessionState?.queueIds) && sessionState.queueIds.length > 0
      ? sessionState.queueIds
      : initialQueueIds,
    position: typeof sessionState?.position === "number" ? sessionState.position : 0,
    isFlipped: Boolean(sessionState?.isFlipped),
    sessionStats: sessionState?.sessionStats || { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
    cardResults: sessionState?.cardResults || {},
    sessionStartedAt: typeof sessionState?.sessionStartedAt === "number" ? sessionState.sessionStartedAt : Date.now(),
  });
  const cardById = useMemo(() => {
    const map = new Map();
    (flashcards || []).forEach((card) => {
      map.set(String(card.id), card);
    });
    return map;
  }, [flashcards]);
  const sessionStartedAtRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionReportedRef = useRef(false);

  // Study timer
  useEffect(() => {
    const id = setInterval(timerTick, 1000);
    return () => { clearInterval(id); timerStop(); };
  }, []);

  const [queueIds, setQueueIds] = useState(restoredStateRef.current.queueIds);
  const [position, setPosition] = useState(restoredStateRef.current.position);
  const [isFlipped, setIsFlipped] = useState(restoredStateRef.current.isFlipped);
  const [sessionStats, setSessionStats] = useState(restoredStateRef.current.sessionStats);
  // Per-card difficulty tracking: { [cardId]: { front, back, grades: [], attempts: n } }
  const [cardResults, setCardResults] = useState(restoredStateRef.current.cardResults);

  const queue = useMemo(
    () => queueIds.map((cardId) => cardById.get(String(cardId))).filter(Boolean),
    [cardById, queueIds]
  );

  const totalUnique = flashcards?.length || 0;
  const currentCard = queue[position];
  const isComplete = position >= queue.length;

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      completedIds: Object.keys(cardResults),
      currentIndex: position,
      stats: {
        ...sessionStats,
        correct: Number(sessionStats.good || 0) + Number(sessionStats.easy || 0),
        incorrect: Number(sessionStats.again || 0) + Number(sessionStats.hard || 0),
      },
      cardResults,
      modeState: {
        queueIds,
        position,
        isFlipped,
        sessionStats,
        cardResults,
        sessionStartedAt: sessionStartedAtRef.current,
      },
    });
  }, [cardResults, isFlipped, onStateChange, position, queueIds, sessionStats]);

  // Notify parent when session completes
  useEffect(() => {
    if (!isComplete || totalUnique <= 0 || sessionReportedRef.current) return;

    sessionReportedRef.current = true;

    const finishedAtIso = new Date().toISOString();
    const startedAtIso = new Date(sessionStartedAtRef.current || Date.now()).toISOString();
    const durationSeconds = Math.max(0, Math.round((Date.now() - (sessionStartedAtRef.current || Date.now())) / 1000));
    const cardsStudied = Number(sessionStats.reviewed || 0);
    const cardsCorrect = Number(sessionStats.good || 0) + Number(sessionStats.easy || 0);
    const cardsIncorrect = Number(sessionStats.again || 0) + Number(sessionStats.hard || 0);

    onSessionComplete?.({
      session_type: 'learn',
      cards_studied: cardsStudied,
      cards_correct: cardsCorrect,
      cards_incorrect: cardsIncorrect,
      started_at: startedAtIso,
      finished_at: finishedAtIso,
      duration_seconds: durationSeconds,
      mode: srsMode,
      reviewed: cardsStudied,
      breakdown: {
        again: Number(sessionStats.again || 0),
        hard: Number(sessionStats.hard || 0),
        good: Number(sessionStats.good || 0),
        easy: Number(sessionStats.easy || 0),
      },
    });

    onComplete?.();
  }, [isComplete, onComplete, onSessionComplete, sessionStats, srsMode, totalUnique]);

  const gradeCard = useCallback((grade) => {
    if (isComplete || !currentCard) return;
    const config = GRADES[grade];

    // Update DB
    if (grade === "again") {
      // Mark as still new, bump again_count
      updateStudentCard(currentCard.id, {
        is_new: true,
        again_count: (currentCard.again_count || 0) + 1,
      });
    } else {
      const intervalDays = config.interval;
      const easeFactor = grade === "easy" ? 2.8 : grade === "good" ? 2.5 : 2.0;
      updateStudentCard(currentCard.id, {
        due: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
        reviews: (currentCard.reviews || 0) + 1,
        retention: (currentCard.retention || 0) + 1,
        is_new: false,
        next_review_days: intervalDays,
        ease_factor: easeFactor,
      });
    }

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      [grade]: prev[grade] + 1,
    }));

    // Track per-card difficulty
    setCardResults(prev => {
      const existing = prev[currentCard.id] || { front: currentCard.front, back: currentCard.back, grades: [], attempts: 0 };
      return {
        ...prev,
        [currentCard.id]: {
          ...existing,
          front: currentCard.front,
          back: currentCard.back,
          grades: [...existing.grades, grade],
          attempts: existing.attempts + 1,
        }
      };
    });

    // Re-queue "Again" cards ~3-5 positions later
    if (grade === "again") {
      const reinsertAt = Math.min(position + 3 + Math.floor(Math.random() * 3), queue.length);
      setQueueIds(prev => {
        const next = [...prev];
        next.splice(reinsertAt, 0, currentCard.id);
        return next;
      });
    }

    setIsFlipped(false);
    setPosition(prev => prev + 1);
  }, [isComplete, currentCard, position, queue.length, updateStudentCard]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isComplete) return;
      if (e.key === "Escape" && onQuit) { onQuit(); return; }
      // Space / Enter to flip card
      if ((e.key === " " || e.key === "Enter") && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (srsMode === "simple") {
        if (e.key === "1") gradeCard("again");
        else if (e.key === "2") gradeCard("good"); // "Know" = good
      } else {
        if (e.key === "1") gradeCard("again");
        else if (e.key === "2") gradeCard("hard");
        else if (e.key === "3") gradeCard("good");
        else if (e.key === "4") gradeCard("easy");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [gradeCard, isComplete, isFlipped, srsMode, onQuit]);

  if (!flashcards) return <LoadingScreen />;

  if (flashcards.length === 0) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>{t("noNewCards")}</h1>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const accuracy = sessionStats.reviewed > 0
      ? Math.round(((sessionStats.good + sessionStats.easy) / sessionStats.reviewed) * 100)
      : 0;
    // Find hardest cards
    const hardestCards = Object.entries(cardResults)
      .map(([id, result]) => ({ id, ...result, hardness: computeHardness(result) }))
      .filter(c => c.hardness > 0)
      .sort((a, b) => b.hardness - a.hardness)
      .slice(0, 5);

    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.sessionSummary}>
            <h1>{t("sessionComplete")}</h1>
            <div className={styles.summaryStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{totalUnique}</span>
                <span className={styles.statLabel}>{t("cards")}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{sessionStats.reviewed}</span>
                <span className={styles.statLabel}>{t("reviewsLabel")}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{accuracy}%</span>
                <span className={styles.statLabel}>{t("accuracy")}</span>
              </div>
            </div>
            <div className={styles.gradeBreakdown}>
              <span className={styles.gradeAgain}>{t("again")}: {sessionStats.again}</span>
              {srsMode === "full" && (
                <span className={styles.gradeHard}>{t("hardGrade")}: {sessionStats.hard}</span>
              )}
              <span className={styles.gradeGood}>{srsMode === "simple" ? t("know") : t("good")}: {sessionStats.good}</span>
              {srsMode === "full" && (
                <span className={styles.gradeEasy}>{t("easy")}: {sessionStats.easy}</span>
              )}
            </div>
            {hardestCards.length > 0 && (
              <div className={styles.hardestSection}>
                <h3 className={styles.hardestTitle}>Hardest Cards</h3>
                {hardestCards.map(card => (
                  <div key={card.id} className={styles.hardestCard}>
                    <span className={styles.hardestTerm}>{(card.front || '').replace(/<[^>]*>/g, '')}</span>
                    <span className={styles.hardestDef}>{(card.back || '').replace(/<[^>]*>/g, '').slice(0, 60)}</span>
                    <span className={styles.hardestBadge}>
                      {card.grades.filter(g => g === 'again').length}× again
                    </span>
                  </div>
                ))}
              </div>
            )}
            {onQuit && (
              <button className={styles.quitBtn} onClick={onQuit} style={{ marginTop: '1rem' }}>
                ← Back to deck
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Progress: count unique cards seen (position capped at totalUnique)
  const progressPct = (Math.min(position, totalUnique) / totalUnique) * 100;

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>
            {t("learnProgress")} {Math.min(position + 1, totalUnique)}/{totalUnique}
          </h1>
          {onQuit && (
            <button className={styles.quitBtn} onClick={onQuit} title="Quit (Esc)">
              ×
            </button>
          )}
        </div>
        <ProgressBar completed={progressPct} />
      </div>
      <div className={styles.content}>
        {currentCard && (
          <FlipCard
            flashcard={currentCard}
            isFlipped={isFlipped}
            setIsFlipped={setIsFlipped}
            showTermFirst={showTermFirst}
            revealSeed={position}
            onSwipeLeft={() => gradeCard("again")}
            onSwipeRight={() => gradeCard("good")}
          />
        )}
      </div>
      {isFlipped && (
        <div className={styles.footer}>
          {srsMode === "simple" ? (
            <>
              <button className={styles.againBtn} onClick={() => gradeCard("again")}>
                {t("again")} <code>{formatInterval(GRADES.again.interval, t)}</code>
              </button>
              <button className={styles.goodBtn} onClick={() => gradeCard("good")}>
                {t("know")} <code>{formatInterval(GRADES.good.interval, t)}</code>
              </button>
            </>
          ) : (
            <>
              <button className={styles.againBtn} onClick={() => gradeCard("again")}>
                {t("again")} <code>{formatInterval(GRADES.again.interval, t)}</code>
              </button>
              <button className={styles.hardBtn} onClick={() => gradeCard("hard")}>
                {t("hardGrade")} <code>{formatInterval(GRADES.hard.interval, t)}</code>
              </button>
              <button className={styles.goodBtn} onClick={() => gradeCard("good")}>
                {t("good")} <code>{formatInterval(GRADES.good.interval, t)}</code>
              </button>
              <button className={styles.easyBtn} onClick={() => gradeCard("easy")}>
                {t("easy")} <code>{formatInterval(GRADES.easy.interval, t)}</code>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Learn;
