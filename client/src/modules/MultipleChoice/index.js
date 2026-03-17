import ProgressBar from "../../common/components/ProgressBar";
import styles from "./MultipleChoice.module.css";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Multiple-choice quiz mode.
 * Shows the term and 4 definition options (1 correct + 3 distractors).
 * Requires at least 4 cards in the deck.
 */
const shuffleItems = (items) => [...items].sort(() => Math.random() - 0.5);

const buildQuestions = (cards, showTermFirst) => {
  if (!Array.isArray(cards)) return [];
  return cards.map((card, currentIndex) => {
    const correctAnswer = showTermFirst ? card.back : card.front;
    const others = shuffleItems(cards.filter((_, i) => i !== currentIndex))
      .slice(0, 3)
      .map((candidate) => (showTermFirst ? candidate.back : candidate.front));
    const options = shuffleItems([correctAnswer, ...others]).map((text, optionIndex) => ({
      text,
      key: String(optionIndex + 1),
      isCorrect: text === correctAnswer,
    }));

    return {
      cardId: card.id,
      prompt: showTermFirst ? card.front : card.back,
      options,
    };
  });
};

const MultipleChoice = ({ flashcards, showTermFirst = true, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const restoredStateRef = useRef({
    questions: Array.isArray(sessionState?.questions) && sessionState.questions.length > 0
      ? sessionState.questions
      : buildQuestions(flashcards || [], showTermFirst),
    current: typeof sessionState?.current === "number" ? sessionState.current : 0,
    selected: typeof sessionState?.selected === "number" ? sessionState.selected : null,
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
  const [selected, setSelected] = useState(restoredStateRef.current.selected);
  const [correctCount, setCorrectCount] = useState(restoredStateRef.current.correctCount);
  const [cardResults, setCardResults] = useState(restoredStateRef.current.cardResults);
  const sessionStartRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionCompleteRef = useRef(false);
  const currentQuestion = questions[current] || null;
  const options = useMemo(() => currentQuestion?.options || [], [currentQuestion]);

  useEffect(() => {
    if (!onStateChange) return;
    const completedIds = questions.slice(0, current).map((question) => question.cardId);
    if (selected !== null && currentQuestion?.cardId != null) {
      completedIds.push(currentQuestion.cardId);
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
        selected,
        correctCount,
        cardResults,
        sessionStartedAt: sessionStartRef.current,
      },
    });
  }, [cardResults, correctCount, current, currentQuestion?.cardId, onStateChange, questions, selected]);

  const handleSelect = useCallback((index) => {
    if (selected !== null) return;
    setSelected(index);
    const isCorrect = options[index]?.isCorrect;
    if (isCorrect) {
      setCorrectCount(c => c + 1);
    }
    // Track per-card result
    const card = currentQuestion ? cardById.get(String(currentQuestion.cardId)) : null;
    setCardResults(prev => ({
      ...prev,
      [String(currentQuestion?.cardId || current)]: {
        front: card?.front || '',
        back: card?.back || '',
        correct: isCorrect,
        selectedText: options[index]?.text || '',
      }
    }));
  }, [cardById, current, currentQuestion, options, selected]);

  const handleNext = useCallback(() => {
    setSelected(null);
    setCurrent(c => c + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onQuit) { onQuit(); return; }
      if (current >= questions.length) return;
      
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
  }, [selected, options, current, questions.length, handleSelect, handleNext, onQuit]);

  // Fire session complete callback when quiz finishes
  useEffect(() => {
    if (current >= questions.length && questions.length > 0 && !sessionCompleteRef.current && onSessionComplete) {
      sessionCompleteRef.current = true;
      const now = new Date().toISOString();
      onSessionComplete({
        session_type: 'test',
        cards_studied: questions.length,
        cards_correct: correctCount,
        cards_incorrect: questions.length - correctCount,
        started_at: sessionStartRef.current,
        finished_at: now,
      });
    }
  }, [current, questions.length, correctCount, onSessionComplete]);

  if (!flashcards) return <LoadingScreen />;

  if (questions.length < 4) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>Need at least 4 cards for multiple choice!</h1>
        </div>
      </div>
    );
  }

  if (current >= questions.length) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const wrongCards = Object.values(cardResults).filter(r => !r.correct).slice(0, 5);
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>Quiz complete!</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>
              {correctCount} / {questions.length} correct
            </div>
            {wrongCards.length > 0 && (
              <div style={{ marginTop: '1rem', textAlign: 'left', width: '100%', maxWidth: 360 }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--fg-muted)' }}>Hardest Cards</h3>
                {wrongCards.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600 }}>{(r.front || '').replace(/<[^>]*>/g, '')}</span>
                    <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                      You: {(r.selectedText || '').replace(/<[^>]*>/g, '').slice(0, 30)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {onQuit && (
              <button onClick={onQuit} style={{
                marginTop: '1rem', padding: '0.45rem 1rem', border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius)', background: 'var(--card-bg)', color: 'var(--fg)',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
              }}>← Back to deck</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const card = currentQuestion ? cardById.get(String(currentQuestion.cardId)) : null;
  const prompt = currentQuestion?.prompt || (card ? (showTermFirst ? card.front : card.back) : "");

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>
            Multiple choice {current + 1}/{questions.length}
          </h1>
          {onQuit && (
            <button onClick={onQuit} title="Quit (Esc)" style={{
              background: 'none', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius)',
              color: 'var(--fg-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit'
            }}>×</button>
          )}
        </div>
        <ProgressBar completed={(current / questions.length) * 100} />
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
