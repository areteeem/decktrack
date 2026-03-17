import ProgressBar from "../../common/components/ProgressBar";
import styles from "./TrueFalse.module.css";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * True / False study mode.
 * Shows a term paired with a definition — 50 % of the time the definition
 * is correct, 50 % it's swapped with a random other card's definition.
 * Student picks True or False.
 */
const shuffleItems = (items) => [...items].sort(() => Math.random() - 0.5);

const buildQuestions = (cards) => {
  if (!Array.isArray(cards)) return [];
  return cards.map((card, index) => {
    const showCorrect = Math.random() >= 0.5;
    let shownDef = card.back;

    if (!showCorrect) {
      const others = cards.filter((_, otherIndex) => otherIndex !== index);
      if (others.length > 0) {
        shownDef = shuffleItems(others)[0].back;
      } else {
        return { cardId: card.id, shownDef: card.back, isCorrect: true };
      }
    }

    return { cardId: card.id, shownDef, isCorrect: showCorrect };
  });
};

const TrueFalse = ({ flashcards, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const restoredStateRef = useRef({
    questions: Array.isArray(sessionState?.questions) && sessionState.questions.length > 0
      ? sessionState.questions
      : buildQuestions(flashcards || []),
    current: typeof sessionState?.current === "number" ? sessionState.current : 0,
    answered: sessionState?.answered ?? null,
    correctCount: Number(sessionState?.correctCount || 0),
    cardResults: sessionState?.cardResults || {},
    sessionStartedAt: sessionState?.sessionStartedAt || new Date().toISOString(),
  });
  const cardById = useMemo(() => {
    const map = new Map();
    (flashcards || []).forEach((card) => {
      map.set(String(card.id), card);
    });
    return map;
  }, [flashcards]);

  const [questions] = useState(restoredStateRef.current.questions);

  const [current, setCurrent] = useState(restoredStateRef.current.current);
  const [answered, setAnswered] = useState(restoredStateRef.current.answered); // "true" | "false" | null
  const [correctCount, setCorrectCount] = useState(restoredStateRef.current.correctCount);
  const [cardResults, setCardResults] = useState(restoredStateRef.current.cardResults);
  const sessionStartRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionCompleteRef = useRef(false);

  const stripHtml = (str) => (str || "").replace(/<[^>]*>/g, "").trim();

  const q = questions[current] || null;
  const currentCard = q ? cardById.get(String(q.cardId)) : null;

  useEffect(() => {
    if (!onStateChange) return;
    const completedIds = questions.slice(0, current).map((question) => question.cardId);
    if (answered !== null && q?.cardId != null) {
      completedIds.push(q.cardId);
    }

    onStateChange({
      completedIds: [...new Set(completedIds)],
      currentIndex: current,
      stats: {
        reviewed: completedIds.length,
        correct: correctCount,
        incorrect: Math.max(0, completedIds.length - correctCount),
      },
      cardResults,
      modeState: {
        questions,
        current,
        answered,
        correctCount,
        cardResults,
        sessionStartedAt: sessionStartRef.current,
      },
    });
  }, [answered, cardResults, correctCount, current, onStateChange, q?.cardId, questions]);

  const handleAnswer = useCallback(
    (choice) => {
      if (answered !== null || !q) return;
      const userSaidTrue = choice === "true";
      const wasRight = userSaidTrue === q.isCorrect;
      setAnswered(choice);
      if (wasRight) setCorrectCount((c) => c + 1);

      setCardResults((prev) => ({
        ...prev,
        [String(q.cardId)]: {
          front: currentCard?.front,
          back: currentCard?.back,
          shownDef: q.shownDef,
          correct: wasRight,
          choice,
        },
      }));
    },
    [answered, currentCard, q]
  );

  const handleNext = useCallback(() => {
    setAnswered(null);
    setCurrent((c) => c + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onQuit) {
        onQuit();
        return;
      }
      if (current >= questions.length) return;

      if (answered !== null) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      if (e.key === "1" || e.key === "t" || e.key === "T") handleAnswer("true");
      if (e.key === "2" || e.key === "f" || e.key === "F") handleAnswer("false");
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [answered, current, questions.length, handleAnswer, handleNext, onQuit]);

  // Fire session complete
  useEffect(() => {
    if (
      current >= questions.length &&
      questions.length > 0 &&
      !sessionCompleteRef.current &&
      onSessionComplete
    ) {
      sessionCompleteRef.current = true;
      onSessionComplete({
        session_type: "test",
        cards_studied: questions.length,
        cards_correct: correctCount,
        cards_incorrect: questions.length - correctCount,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
      });
    }
  }, [current, questions.length, correctCount, onSessionComplete]);

  if (!flashcards) return <LoadingScreen />;

  if (questions.length === 0) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>No cards available</h1>
        </div>
      </div>
    );
  }

  // Completion screen
  if (current >= questions.length) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const wrongCards = Object.values(cardResults)
      .filter((r) => !r.correct)
      .slice(0, 5);
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>True / False complete!</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>
              {correctCount} / {questions.length} correct
            </div>
            {wrongCards.length > 0 && (
              <div className={styles.hardestList}>
                <h3 className={styles.hardestTitle}>Hardest Cards</h3>
                {wrongCards.map((r, i) => (
                  <div key={i} className={styles.hardestItem}>
                    <span className={styles.hardestTerm}>
                      {stripHtml(r.front).slice(0, 30)}
                    </span>
                    <span className={styles.hardestStatus}>
                      {r.choice === "true" ? "Said True" : "Said False"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {onQuit && (
              <button onClick={onQuit} className={styles.backBtn}>
                ← Back to deck
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const wasRight = answered !== null && (answered === "true") === q.isCorrect;

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1>
            True / False {current + 1}/{questions.length}
          </h1>
          {onQuit && (
            <button
              onClick={onQuit}
              title="Quit (Esc)"
              style={{
                background: "none",
                border: "1.5px solid var(--border-color)",
                borderRadius: "var(--radius)",
                color: "var(--fg-muted)",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                fontSize: "0.8rem",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          )}
        </div>
        <ProgressBar completed={(current / questions.length) * 100} />
      </div>
      <div className={styles.content}>
        <div className={styles.card}>
          <p className={styles.term}>{stripHtml(currentCard?.front)}</p>
          <p className={styles.definition}>{stripHtml(q.shownDef)}</p>

          <div className={styles.buttons}>
            <button
              className={`${styles.tfBtn}${answered === "true" ? (wasRight ? ` ${styles.selectedCorrect}` : ` ${styles.selectedWrong}`) : ""}`}
              onClick={() => handleAnswer("true")}
              disabled={answered !== null}
            >
              <span className={styles.keyHint}>1</span>
              True
            </button>
            <button
              className={`${styles.tfBtn}${answered === "false" ? (wasRight ? ` ${styles.selectedCorrect}` : ` ${styles.selectedWrong}`) : ""}`}
              onClick={() => handleAnswer("false")}
              disabled={answered !== null}
            >
              <span className={styles.keyHint}>2</span>
              False
            </button>
          </div>

          {answered !== null && (
            <>
              <p
                className={`${styles.feedback} ${wasRight ? styles.feedbackCorrect : styles.feedbackWrong}`}
              >
                {wasRight ? "Correct!" : "Not quite"}
              </p>
              {!wasRight && (
                <p className={styles.correctDef}>
                  Correct definition:{" "}
                  <strong>{stripHtml(currentCard?.back)}</strong>
                </p>
              )}
              <button className={styles.nextBtn} onClick={handleNext}>
                Next →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrueFalse;
