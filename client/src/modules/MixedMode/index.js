import ProgressBar from "../../common/components/ProgressBar";
import styles from "./MixedMode.module.css";
import { useState, useEffect, useCallback, useRef } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Mixed study mode — randomly shuffles MCQ, True/False, and Fill-in-the-blank
 * question types together for varied practice.
 */
const QUESTION_TYPES = ["mcq", "truefalse", "fillblank"];

const stripHtml = (str) => (str || "").replace(/<[^>]*>/g, "").trim();

const normalize = (s) => stripHtml(s).toLowerCase().trim();

const shuffleItems = (items) => [...items].sort(() => Math.random() - 0.5);

const buildQuestions = (cards, showTermFirst) => {
  if (!Array.isArray(cards)) return [];

  return cards.map((card, index) => {
    const type = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];

    if (type === "mcq") {
      const correctAnswer = showTermFirst ? card.back : card.front;
      const others = shuffleItems(cards.filter((_, questionIndex) => questionIndex !== index))
        .slice(0, 3)
        .map((candidate) => (showTermFirst ? candidate.back : candidate.front));
      const options = shuffleItems([correctAnswer, ...others])
        .map((text, optionIndex) => ({ text, key: String(optionIndex + 1), isCorrect: text === correctAnswer }));

      return { cardId: card.id, type: "mcq", prompt: showTermFirst ? card.front : card.back, options };
    }

    if (type === "truefalse") {
      const showCorrect = Math.random() >= 0.5;
      let shownDef = card.back;
      if (!showCorrect) {
        const others = cards.filter((_, questionIndex) => questionIndex !== index);
        if (others.length > 0) {
          shownDef = shuffleItems(others)[0].back;
        } else {
          return { cardId: card.id, type: "truefalse", prompt: card.front, shownDef: card.back, isCorrect: true };
        }
      }
      return { cardId: card.id, type: "truefalse", prompt: card.front, shownDef, isCorrect: showCorrect };
    }

    return {
      cardId: card.id,
      type: "fillblank",
      prompt: showTermFirst ? card.front : card.back,
      answer: showTermFirst ? card.back : card.front,
    };
  });
};

const MixedMode = ({ flashcards, showTermFirst = true, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const restoredStateRef = useRef({
    questions: Array.isArray(sessionState?.questions) && sessionState.questions.length > 0
      ? sessionState.questions
      : buildQuestions(flashcards || [], showTermFirst),
    current: typeof sessionState?.current === "number" ? sessionState.current : 0,
    answered: Boolean(sessionState?.answered),
    correctCount: Number(sessionState?.correctCount || 0),
    lastCorrect: typeof sessionState?.lastCorrect === "boolean" ? sessionState.lastCorrect : null,
    mcqSelected: typeof sessionState?.mcqSelected === "number" ? sessionState.mcqSelected : null,
    tfChoice: sessionState?.tfChoice ?? null,
    fillValue: String(sessionState?.fillValue || ""),
    fillChecked: Boolean(sessionState?.fillChecked),
    sessionStartedAt: sessionState?.sessionStartedAt || new Date().toISOString(),
  });

  const [questions] = useState(restoredStateRef.current.questions);

  const [current, setCurrent] = useState(restoredStateRef.current.current);
  const [answered, setAnswered] = useState(restoredStateRef.current.answered);
  const [correctCount, setCorrectCount] = useState(restoredStateRef.current.correctCount);
  const [lastCorrect, setLastCorrect] = useState(restoredStateRef.current.lastCorrect);
  // MCQ state
  const [mcqSelected, setMcqSelected] = useState(restoredStateRef.current.mcqSelected);
  // T/F state
  const [tfChoice, setTfChoice] = useState(restoredStateRef.current.tfChoice);
  // Fill blank state
  const [fillValue, setFillValue] = useState(restoredStateRef.current.fillValue);
  const [fillChecked, setFillChecked] = useState(restoredStateRef.current.fillChecked);

  const sessionStartRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionCompleteRef = useRef(false);
  const fillInputRef = useRef(null);

  const q = questions[current] || null;

  useEffect(() => {
    if (!onStateChange) return;
    const completedIds = questions.slice(0, current).map((question) => question.cardId);
    if (answered && q?.cardId != null) {
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
      modeState: {
        questions,
        current,
        answered,
        correctCount,
        lastCorrect,
        mcqSelected,
        tfChoice,
        fillValue,
        fillChecked,
        sessionStartedAt: sessionStartRef.current,
      },
    });
  }, [answered, correctCount, current, fillChecked, fillValue, lastCorrect, mcqSelected, onStateChange, q?.cardId, questions, tfChoice]);

  const advance = useCallback(() => {
    setAnswered(false);
    setLastCorrect(null);
    setMcqSelected(null);
    setTfChoice(null);
    setFillValue("");
    setFillChecked(false);
    setCurrent((c) => c + 1);
  }, []);

  // MCQ answer
  const handleMcqSelect = useCallback(
    (idx) => {
      if (answered) return;
      setMcqSelected(idx);
      setAnswered(true);
      const correct = q.options[idx]?.isCorrect;
      setLastCorrect(correct);
      if (correct) setCorrectCount((c) => c + 1);
    },
    [answered, q]
  );

  // T/F answer
  const handleTfAnswer = useCallback(
    (choice) => {
      if (answered) return;
      setTfChoice(choice);
      setAnswered(true);
      const correct = choice === q.isCorrect;
      setLastCorrect(correct);
      if (correct) setCorrectCount((c) => c + 1);
    },
    [answered, q]
  );

  // Fill blank check
  const handleFillCheck = useCallback(() => {
    if (fillChecked) return;
    setFillChecked(true);
    setAnswered(true);
    const correct = normalize(fillValue) === normalize(q.answer);
    setLastCorrect(correct);
    if (correct) setCorrectCount((c) => c + 1);
  }, [fillChecked, fillValue, q]);

  // Focus fill input when question type is fillblank
  useEffect(() => {
    if (q?.type === "fillblank" && fillInputRef.current) {
      fillInputRef.current.focus();
    }
  }, [current, q?.type]);

  // Keyboard
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") { onQuit?.(); return; }
      if (current >= questions.length) return;

      if (answered) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); }
        return;
      }

      if (q?.type === "mcq") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 4 && num <= (q.options?.length || 0)) handleMcqSelect(num - 1);
      }
      if (q?.type === "truefalse") {
        if (e.key === "t" || e.key === "T") handleTfAnswer(true);
        if (e.key === "f" || e.key === "F") handleTfAnswer(false);
      }
      if (q?.type === "fillblank" && e.key === "Enter") {
        e.preventDefault();
        handleFillCheck();
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [answered, current, questions.length, q, advance, handleMcqSelect, handleTfAnswer, handleFillCheck, onQuit]);

  // Session complete
  useEffect(() => {
    if (current >= questions.length && questions.length > 0 && !sessionCompleteRef.current && onSessionComplete) {
      sessionCompleteRef.current = true;
      onSessionComplete({
        session_type: "mixed",
        cards_studied: questions.length,
        cards_correct: correctCount,
        cards_incorrect: questions.length - correctCount,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
      });
    }
  }, [current, questions.length, correctCount, onSessionComplete]);

  if (!flashcards) return <LoadingScreen />;

  if (questions.length < 4) {
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <h1>Need at least 4 cards for mixed mode.</h1>
          {onQuit && <button className={styles.backBtn} onClick={onQuit}>Back</button>}
        </div>
      </div>
    );
  }

  // Results screen
  if (current >= questions.length) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.results}>
            <h2>Mixed mode complete</h2>
            <div className={styles.score}>{pct}%</div>
            <div className={styles.scoreLabel}>{correctCount} / {questions.length} correct</div>
            {onQuit && <button className={styles.backBtn} onClick={onQuit}>Back to deck</button>}
          </div>
        </div>
      </div>
    );
  }

  const typeLabel = q.type === "mcq" ? "Multiple choice" : q.type === "truefalse" ? "True / False" : "Fill in the blank";

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Mixed {current + 1}/{questions.length}</h1>
          {onQuit && <button className={styles.quitBtn} onClick={onQuit}>Quit</button>}
        </div>
        <ProgressBar completed={(current / questions.length) * 100} />
      </div>

      <div className={styles.modeTag}>{typeLabel}</div>

      <div className={styles.content}>
        <div className={styles.questionCard}>
          <p className={styles.prompt}>{stripHtml(q.prompt)}</p>

          {/* MCQ */}
          {q.type === "mcq" && (
            <>
              <div className={styles.options}>
                {q.options.map((opt, i) => {
                  let cls = styles.option;
                  if (answered) {
                    if (opt.isCorrect) cls += ` ${styles.correctOption}`;
                    else if (i === mcqSelected && !opt.isCorrect) cls += ` ${styles.wrongOption}`;
                  }
                  return (
                    <button key={i} className={cls} onClick={() => handleMcqSelect(i)} disabled={answered}>
                      <span className={styles.optionKey}>{i + 1}</span>
                      {stripHtml(opt.text)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* True/False */}
          {q.type === "truefalse" && (
            <>
              <div className={styles.shownDef}>{stripHtml(q.shownDef)}</div>
              <div className={styles.tfButtons}>
                <button
                  className={`${styles.tfBtn} ${answered && q.isCorrect ? styles.tfBtnCorrect : ""} ${answered && tfChoice === true && !q.isCorrect ? styles.tfBtnWrong : ""}`}
                  onClick={() => handleTfAnswer(true)}
                  disabled={answered}
                >
                  True (T)
                </button>
                <button
                  className={`${styles.tfBtn} ${answered && !q.isCorrect ? styles.tfBtnCorrect : ""} ${answered && tfChoice === false && q.isCorrect ? styles.tfBtnWrong : ""}`}
                  onClick={() => handleTfAnswer(false)}
                  disabled={answered}
                >
                  False (F)
                </button>
              </div>
            </>
          )}

          {/* Fill blank */}
          {q.type === "fillblank" && (
            <>
              <div className={styles.fillRow}>
                <input
                  ref={fillInputRef}
                  className={`${styles.fillInput} ${fillChecked ? (lastCorrect ? styles.fillInputCorrect : styles.fillInputWrong) : ""}`}
                  type="text"
                  value={fillValue}
                  onChange={(e) => setFillValue(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={fillChecked}
                  autoComplete="off"
                />
                {!fillChecked && (
                  <button className={styles.checkBtn} onClick={handleFillCheck}>Check</button>
                )}
              </div>
              {fillChecked && !lastCorrect && (
                <p className={styles.correctAnswer}>Correct: {stripHtml(q.answer)}</p>
              )}
            </>
          )}

          {/* Feedback + Next */}
          {answered && (
            <>
              <p className={`${styles.feedback} ${lastCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                {lastCorrect ? "Correct!" : "Not quite"}
              </p>
              <button className={styles.nextBtn} onClick={advance}>Next</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MixedMode;
