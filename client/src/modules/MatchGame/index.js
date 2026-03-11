import styles from "./MatchGame.module.css";
import ProgressBar from "../../common/components/ProgressBar";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import LoadingScreen from "../../common/components/LoadingScreen";

/**
 * Matching game: match terms to definitions.
 * Shows 6 cards at a time (or fewer for the last batch).
 * Click a term, then click its matching definition.
 */
const BATCH_SIZE = 6;

const MatchGame = ({ flashcards }) => {
  const shuffled = useMemo(() => {
    if (!flashcards) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [wrongPair, setWrongPair] = useState(null);
  const [totalMatched, setTotalMatched] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const isComplete = totalMatched >= shuffled.length;

  // Timer
  useEffect(() => {
    if (isComplete) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [startTime, isComplete]);

  // Current batch
  const batch = useMemo(() => {
    const start = batchIndex * BATCH_SIZE;
    return shuffled.slice(start, start + BATCH_SIZE);
  }, [shuffled, batchIndex]);

  // Shuffled definitions for the batch
  const shuffledDefs = useMemo(() => {
    return [...batch].sort(() => Math.random() - 0.5);
  }, [batch]);

  const handleTermClick = useCallback((cardId) => {
    if (matched.has(cardId)) return;
    setWrongPair(null);
    setSelectedTerm(cardId);
  }, [matched]);

  const handleDefClick = useCallback((cardId) => {
    if (!selectedTerm || matched.has(cardId)) return;
    setWrongPair(null);

    if (selectedTerm === cardId) {
      // Correct match
      setMatched(prev => new Set([...prev, cardId]));
      setSelectedTerm(null);
      setTotalMatched(prev => prev + 1);

      // Check if batch complete
      if (matched.size + 1 >= batch.length) {
        setTimeout(() => {
          setBatchIndex(prev => prev + 1);
          setMatched(new Set());
          setSelectedTerm(null);
        }, 500);
      }
    } else {
      // Wrong match
      setWrongPair({ term: selectedTerm, def: cardId });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedTerm(null);
      }, 600);
    }
  }, [selectedTerm, matched, batch.length]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!flashcards) return <LoadingScreen />;

  if (shuffled.length < 2) {
    return (
      <div className={styles.layout}>
        <div className={styles.results}>
          <h2>Need at least 2 cards to play matching!</h2>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className={styles.layout}>
        <div className={styles.results}>
          <h2>Matching complete!</h2>
          <div className={styles.score}>{formatTime(elapsed)}</div>
          <div className={styles.scoreLabel}>
            {shuffled.length} pairs matched
          </div>
        </div>
      </div>
    );
  }

  const progress = (totalMatched / shuffled.length) * 100;

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Match {totalMatched}/{shuffled.length}</h1>
          <span className={styles.timer}>{formatTime(elapsed)}</span>
        </div>
        <ProgressBar completed={progress} />
      </div>
      <div className={styles.board}>
        <div className={styles.column}>
          {batch.map((card) => {
            let cls = styles.tile;
            if (matched.has(card.id)) cls += ` ${styles.tileMatched}`;
            else if (selectedTerm === card.id) cls += ` ${styles.tileSelected}`;
            else if (wrongPair?.term === card.id) cls += ` ${styles.tileWrong}`;
            return (
              <div
                key={`term-${card.id}`}
                className={cls}
                onClick={() => handleTermClick(card.id)}
              >
                {card.front}
              </div>
            );
          })}
        </div>
        <div className={styles.column}>
          {shuffledDefs.map((card) => {
            let cls = styles.tile;
            if (matched.has(card.id)) cls += ` ${styles.tileMatched}`;
            else if (wrongPair?.def === card.id) cls += ` ${styles.tileWrong}`;
            return (
              <div
                key={`def-${card.id}`}
                className={cls}
                onClick={() => handleDefClick(card.id)}
              >
                {card.back}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MatchGame;
