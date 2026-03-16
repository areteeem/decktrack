import ProgressBar from "../../common/components/ProgressBar";
import styles from "./FillBlank.module.css";
import { useState, useRef, useEffect, useMemo } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Build a prompt from the definition (card.back) with the term (card.front) replaced by a blank.
 * If the term doesn't appear in the definition, just show the definition as-is with a "___" prefix.
 */
const buildBlankPrompt = (definition, term) => {
  if (!definition || !term) return { parts: [definition || ''], hasBlank: false };
  const plainTerm = (term || '').replace(/<[^>]*>/g, '').trim();
  if (!plainTerm) return { parts: [definition], hasBlank: false };
  const regex = new RegExp(`(${plainTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = definition.split(regex);
  if (parts.length <= 1) return { parts: [definition], hasBlank: false };
  // Replace matched parts with blank markers
  const result = parts.map((part, i) =>
    regex.test(part) ? { type: 'blank', index: i } : part
  );
  return { parts: result, hasBlank: true };
};

const FillBlank = ({ flashcards, onQuit, onSessionComplete }) => {
  const shuffled = useMemo(() => {
    if (!flashcards) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState(null); // null | 'correct' | 'wrong'
  const [correctCount, setCorrectCount] = useState(0);
  // Per-card tracking: { [index]: { front, back, correct: bool, userAnswer } }
  const [cardResults, setCardResults] = useState({});
  const sessionStartRef = useRef(new Date().toISOString());
  const sessionCompleteRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

  // Fire session complete callback when quiz finishes
  useEffect(() => {
    if (current >= shuffled.length && shuffled.length > 0 && !sessionCompleteRef.current && onSessionComplete) {
      sessionCompleteRef.current = true;
      const now = new Date().toISOString();
      onSessionComplete({
        session_type: 'test',
        cards_studied: shuffled.length,
        cards_correct: correctCount,
        cards_incorrect: shuffled.length - correctCount,
        started_at: sessionStartRef.current,
        finished_at: now,
      });
    }
  }, [current, shuffled.length, correctCount, onSessionComplete]);

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
    // Wrong cards = hardest
    const wrongCards = Object.values(cardResults)
      .filter(r => !r.correct)
      .slice(0, 5);

    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>Quiz complete!</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>
              {correctCount} / {shuffled.length} correct
            </div>
            {wrongCards.length > 0 && (
              <div style={{ marginTop: '1rem', textAlign: 'left', width: '100%', maxWidth: 360 }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--fg-muted)' }}>Hardest Cards</h3>
                {wrongCards.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600 }}>{(r.front || '').replace(/<[^>]*>/g, '')}</span>
                    <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                      You: {r.userAnswer || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {onQuit && (
              <button className={styles.nextBtn} onClick={onQuit} style={{ marginTop: '1rem' }}>
                ← Back to deck
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const card = shuffled[current];
  const isFillBlankType = card.card_type === 'fill_blank';
  // For fill_blank card type: front is the sentence with ___, back is the answer
  // For normal cards: front is the term (correct answer), back is the definition
  const correctAnswer = isFillBlankType
    ? (card.back || '').replace(/<[^>]*>/g, '').trim()
    : (card.front || '').replace(/<[^>]*>/g, '').trim();
  const { parts, hasBlank } = isFillBlankType
    ? { parts: null, hasBlank: false }
    : buildBlankPrompt(card.back, card.front);

  const handleCheck = () => {
    if (status) return;
    const isCorrect =
      answer.trim().toLowerCase() === correctAnswer.toLowerCase();
    setStatus(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);
    // Track result
    setCardResults(prev => ({
      ...prev,
      [current]: { front: card.front, back: card.back, correct: isCorrect, userAnswer: answer.trim() }
    }));
  };

  const handleNext = () => {
    setAnswer("");
    setStatus(null);
    setCurrent((c) => c + 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && onQuit) { onQuit(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (status) {
        handleNext();
      } else {
        handleCheck();
      }
    }
  };

  // Render the prompt: definition with blanks where the term appears
  const renderPrompt = () => {
    // Fill-blank card type: front is the sentence, show it with ___ highlighted
    if (isFillBlankType) {
      const frontText = (card.front || '').replace(/<[^>]*>/g, '');
      const blankParts = frontText.split(/(_{2,})/);
      return (
        <p className={styles.prompt}>
          {blankParts.map((part, i) =>
            /_{2,}/.test(part)
              ? <span key={i} style={{ display: 'inline-block', minWidth: 80, borderBottom: '2px solid currentColor', margin: '0 4px', textAlign: 'center' }}>
                  {status ? (
                    <span style={{ color: status === 'correct' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      {correctAnswer}
                    </span>
                  ) : '______'}
                </span>
              : <span key={i}>{part}</span>
          )}
        </p>
      );
    }
    if (!hasBlank) {
      return (
        <div>
          <p className={styles.prompt} style={{ marginBottom: 8 }}>{card.back}</p>
          <p style={{ fontSize: '0.85em', opacity: 0.7 }}>What term matches this definition?</p>
        </div>
      );
    }
    return (
      <p className={styles.prompt}>
        {parts.map((part, i) =>
          typeof part === 'object' && part.type === 'blank'
            ? <span key={i} style={{ display: 'inline-block', minWidth: 80, borderBottom: '2px solid currentColor', margin: '0 4px', textAlign: 'center' }}>
                {status ? (
                  <span style={{ color: status === 'correct' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {correctAnswer}
                  </span>
                ) : '______'}
              </span>
            : <span key={i}>{part}</span>
        )}
      </p>
    );
  };

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>
            Fill in the blank {current + 1}/{shuffled.length}
          </h1>
          {onQuit && (
            <button onClick={onQuit} title="Quit (Esc)" style={{
              background: 'none', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius)',
              color: 'var(--fg-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit'
            }}>×</button>
          )}
        </div>
        <ProgressBar completed={((current) / shuffled.length) * 100} />
      </div>
      <div className={styles.content}>
        <div className={styles.quizCard}>
          {renderPrompt()}
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={`${styles.answerInput}${status ? ` ${styles[status]}` : ""}`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type the term..."
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
                Answer: {correctAnswer}
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
