import ProgressBar from "../../common/components/ProgressBar";
import styles from "./MultipleChoice.module.css";
import { useState, useMemo, useEffect, useCallback } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Multiple-choice quiz mode.
 * Shows the term and 4 definition options (1 correct + 3 distractors).
 * Requires at least 4 cards in the deck.
 */
const MultipleChoice = ({ flashcards, showTermFirst = true }) => {
  const shuffled = useMemo(() => {
    if (!flashcards) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);

  // Generate 4 options for the current card
  const options = useMemo(() => {
    if (!shuffled.length || current >= shuffled.length) return [];
    const card = shuffled[current];
    const correctAnswer = showTermFirst ? card.back : card.front;
    
    // Get 3 random distractor answers from other cards
    const others = shuffled
      .filter((_, i) => i !== current)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => showTermFirst ? c.back : c.front);

    // Combine and shuffle
    const allOptions = [correctAnswer, ...others].sort(() => Math.random() - 0.5);
    return allOptions.map((text, i) => ({
      text,
      key: String(i + 1),
      isCorrect: text === correctAnswer,
    }));
  }, [shuffled, current, showTermFirst]);

  const handleSelect = useCallback((index) => {
    if (selected !== null) return;
    setSelected(index);
    if (options[index]?.isCorrect) {
      setCorrectCount(c => c + 1);
    }
  }, [selected, options]);

  const handleNext = useCallback(() => {
    setSelected(null);
    setCurrent(c => c + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (current >= shuffled.length) return;
      
      if (selected !== null) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 4 && num <= options.length) {
        handleSelect(num - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [selected, options, current, shuffled.length, handleSelect, handleNext]);

  if (!flashcards) return <LoadingScreen />;

  if (shuffled.length < 4) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>Need at least 4 cards for multiple choice!</h1>
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
  const prompt = showTermFirst ? card.front : card.back;

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <h1>
          Multiple choice {current + 1}/{shuffled.length}
        </h1>
        <ProgressBar completed={(current / shuffled.length) * 100} />
      </div>
      <div className={styles.content}>
        <div className={styles.quizCard}>
          <p className={styles.prompt}>{prompt}</p>
          <div className={styles.options}>
            {options.map((opt, i) => {
              let cls = styles.option;
              if (selected !== null) {
                if (opt.isCorrect) cls += ` ${styles.correctOption}`;
                else if (i === selected && !opt.isCorrect) cls += ` ${styles.wrongOption}`;
              } else if (i === selected) {
                cls += ` ${styles.selected}`;
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                >
                  <span className={styles.optionKey}>{i + 1}</span>
                  {opt.text}
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <>
              <p className={`${styles.feedback} ${options[selected].isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                {options[selected].isCorrect ? "Correct!" : "Not quite"}
              </p>
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

export default MultipleChoice;
