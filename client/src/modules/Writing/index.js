import ProgressBar from "../../common/components/ProgressBar";
import styles from "./Writing.module.css";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Writing study mode.
 * Shows the definition (or term), student types the answer.
 * Case-insensitive comparison with trimming.
 */
const Writing = ({ flashcards, showTermFirst = true, onQuit, onSessionComplete }) => {
  const shuffled = useMemo(() => {
    if (!flashcards) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [cardResults, setCardResults] = useState({});
  const inputRef = useRef(null);
  const sessionStartRef = useRef(new Date().toISOString());
  const sessionCompleteRef = useRef(false);

  const card = shuffled[current] || null;

  // The prompt is what we show, the answer is what the user types
  const prompt = card ? (showTermFirst ? card.back : card.front) : "";
  const answer = card ? (showTermFirst ? card.front : card.back) : "";

  // Strip HTML tags for comparison
  const stripHtml = (str) => (str || "").replace(/<[^>]*>/g, "").trim();

  const normalize = (str) => stripHtml(str).toLowerCase().trim();

  const handleCheck = useCallback(() => {
    if (checked || !input.trim()) return;
    const correct = normalize(input) === normalize(answer);
    setChecked(true);
    setIsCorrect(correct);
    if (correct) setCorrectCount((c) => c + 1);

    setCardResults((prev) => ({
      ...prev,
      [current]: {
        front: card?.front || "",
        back: card?.back || "",
        correct,
        typed: input.trim(),
      },
    }));
  }, [checked, input, answer, current, card]);

  const handleNext = useCallback(() => {
    setChecked(false);
    setIsCorrect(false);
    setInput("");
    setCurrent((c) => c + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onQuit) {
        onQuit();
        return;
      }
      if (current >= shuffled.length) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (checked) handleNext();
        else handleCheck();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [checked, current, shuffled.length, handleCheck, handleNext, onQuit]);

  // Focus input on mount and card change
  useEffect(() => {
    if (current < shuffled.length) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [current, shuffled.length]);

  // Fire session complete
  useEffect(() => {
    if (
      current >= shuffled.length &&
      shuffled.length > 0 &&
      !sessionCompleteRef.current &&
      onSessionComplete
    ) {
      sessionCompleteRef.current = true;
      onSessionComplete({
        session_type: "test",
        cards_studied: shuffled.length,
        cards_correct: correctCount,
        cards_incorrect: shuffled.length - correctCount,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
      });
    }
  }, [current, shuffled.length, correctCount, onSessionComplete]);

  if (!flashcards) return <LoadingScreen />;

  if (shuffled.length === 0) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>No cards available</h1>
        </div>
      </div>
    );
  }

  // Completion screen
  if (current >= shuffled.length) {
    const pct = Math.round((correctCount / shuffled.length) * 100);
    const wrongCards = Object.values(cardResults)
      .filter((r) => !r.correct)
      .slice(0, 5);
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>Writing complete!</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>
              {correctCount} / {shuffled.length} correct
            </div>
            {wrongCards.length > 0 && (
              <div className={styles.hardestList}>
                <h3 className={styles.hardestTitle}>Hardest Cards</h3>
                {wrongCards.map((r, i) => (
                  <div key={i} className={styles.hardestItem}>
                    <span className={styles.hardestTerm}>
                      {stripHtml(r.front).slice(0, 30)}
                    </span>
                    <span className={styles.hardestAnswer}>
                      You: {(r.typed || "").slice(0, 30)}
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
            Writing {current + 1}/{shuffled.length}
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
        <ProgressBar completed={(current / shuffled.length) * 100} />
      </div>
      <div className={styles.content}>
        <div className={styles.card}>
          <p className={styles.promptLabel}>
            {showTermFirst ? "Definition" : "Term"}
          </p>
          <p className={styles.prompt}>{stripHtml(prompt)}</p>

          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={`${styles.input}${checked ? (isCorrect ? ` ${styles.inputCorrect}` : ` ${styles.inputWrong}`) : ""}`}
              type="text"
              placeholder={
                showTermFirst ? "Type the term..." : "Type the definition..."
              }
              value={input}
              onChange={(e) => !checked && setInput(e.target.value)}
              readOnly={checked}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {!checked && (
              <button
                className={styles.checkBtn}
                onClick={handleCheck}
                disabled={!input.trim()}
              >
                Check
              </button>
            )}
          </div>

          {checked && (
            <>
              <p
                className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}
              >
                {isCorrect ? "Correct!" : "Not quite"}
              </p>
              {!isCorrect && (
                <p className={styles.correctAnswer}>
                  Correct answer: <strong>{stripHtml(answer)}</strong>
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

export default Writing;
