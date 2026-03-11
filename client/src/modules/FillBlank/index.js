import ProgressBar from "../../common/components/ProgressBar";
import styles from "./FillBlank.module.css";
import { useState, useRef, useEffect, useMemo } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

const FillBlank = ({ flashcards }) => {
  const shuffled = useMemo(() => {
    if (!flashcards) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState(null); // null | 'correct' | 'wrong'
  const [correctCount, setCorrectCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

  if (!flashcards) return <LoadingScreen />;

  if (shuffled.length === 0) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>No cards to quiz on!</h1>
        </div>
      </div>
    );
  }

  if (current >= shuffled.length) {
    const pct = Math.round((correctCount / shuffled.length) * 100);
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>Quiz complete!</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>
              {correctCount} / {shuffled.length} correct
            </div>
          </div>
        </div>
      </div>
    );
  }

  const card = shuffled[current];

  const handleCheck = () => {
    if (status) return;
    const isCorrect =
      answer.trim().toLowerCase() === card.back.trim().toLowerCase();
    setStatus(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    setAnswer("");
    setStatus(null);
    setCurrent((c) => c + 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (status) {
        handleNext();
      } else {
        handleCheck();
      }
    }
  };

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <h1>
          Fill in the blank {current + 1}/{shuffled.length}
        </h1>
        <ProgressBar completed={((current) / shuffled.length) * 100} />
      </div>
      <div className={styles.content}>
        <div className={styles.quizCard}>
          <p className={styles.prompt}>{card.front}</p>
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={`${styles.answerInput}${status ? ` ${styles[status]}` : ""}`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type the definition..."
              disabled={!!status}
              autoComplete="off"
            />
            {!status && (
              <button
                className={styles.checkBtn}
                onClick={handleCheck}
                disabled={!answer.trim()}
              >
                Check
              </button>
            )}
          </div>
          {status === "correct" && (
            <p className={`${styles.feedback} ${styles.correct}`}>Correct!</p>
          )}
          {status === "wrong" && (
            <>
              <p className={`${styles.feedback} ${styles.wrong}`}>Not quite</p>
              <p className={styles.correctAnswer}>
                Answer: {card.back}
              </p>
            </>
          )}
          {status && (
            <button className={styles.nextBtn} onClick={handleNext}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FillBlank;
