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

const shuffleItems = (items) => [...items].sort(() => Math.random() - 0.5);

const buildDefinitionOrder = (cards) => shuffleItems(cards).map((card) => card.id);

const MatchGame = ({ flashcards, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const shuffled = useMemo(() => flashcards || [], [flashcards]);
  const initialBatch = useMemo(() => shuffled.slice(0, BATCH_SIZE), [shuffled]);
  const restoredStateRef = useRef({
    batchIndex: typeof sessionState?.batchIndex === "number" ? sessionState.batchIndex : 0,
    selectedTerm: sessionState?.selectedTerm ?? null,
    matchedIds: Array.isArray(sessionState?.matchedIds) ? sessionState.matchedIds : [],
    wrongPair: sessionState?.wrongPair ?? null,
    totalMatched: Number(sessionState?.totalMatched || 0),
    startTime: typeof sessionState?.startTime === "number" ? sessionState.startTime : Date.now(),
    elapsed: Number(sessionState?.elapsed || 0),
    missCount: sessionState?.missCount || {},
    definitionOrder: Array.isArray(sessionState?.definitionOrder) && sessionState.definitionOrder.length > 0
      ? sessionState.definitionOrder
      : buildDefinitionOrder(initialBatch),
    sessionStartedAt: sessionState?.sessionStartedAt || new Date().toISOString(),
  });

  const [batchIndex, setBatchIndex] = useState(restoredStateRef.current.batchIndex);
  const [selectedTerm, setSelectedTerm] = useState(restoredStateRef.current.selectedTerm);
  const [matched, setMatched] = useState(new Set(restoredStateRef.current.matchedIds));
  const [wrongPair, setWrongPair] = useState(restoredStateRef.current.wrongPair);
  const [totalMatched, setTotalMatched] = useState(restoredStateRef.current.totalMatched);
  const [startTime] = useState(restoredStateRef.current.startTime);
  const [elapsed, setElapsed] = useState(restoredStateRef.current.elapsed);
  const [missCount, setMissCount] = useState(restoredStateRef.current.missCount);
  const [definitionOrder, setDefinitionOrder] = useState(restoredStateRef.current.definitionOrder);
  const timerRef = useRef(null);
  const sessionStartRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionCompleteRef = useRef(false);

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
    const cardsById = new Map(batch.map((card) => [String(card.id), card]));
    return definitionOrder.map((cardId) => cardsById.get(String(cardId))).filter(Boolean);
  }, [batch, definitionOrder]);

  useEffect(() => {
    const batchIds = batch.map((card) => String(card.id));
    setDefinitionOrder((prev) => {
      const previous = Array.isArray(prev) ? prev.map(String) : [];
      const matchesBatch = previous.length === batchIds.length && previous.every((cardId) => batchIds.includes(cardId));
      return matchesBatch ? previous : buildDefinitionOrder(batch);
    });
  }, [batch]);

  useEffect(() => {
    if (!onStateChange) return;
    const completedBatchIds = shuffled.slice(0, batchIndex * BATCH_SIZE).map((card) => card.id);
    const completedIds = [...new Set([...completedBatchIds, ...Array.from(matched)])];
    const totalMisses = Object.values(missCount).reduce((sum, value) => sum + Number(value || 0), 0);

    onStateChange({
      completedIds,
      currentIndex: completedIds.length,
      stats: {
        reviewed: completedIds.length,
        correct: completedIds.length,
        incorrect: totalMisses,
      },
      modeState: {
        batchIndex,
        selectedTerm,
        matchedIds: Array.from(matched),
        wrongPair,
        totalMatched,
        startTime,
        elapsed,
        missCount,
        definitionOrder,
        sessionStartedAt: sessionStartRef.current,
      },
    });
  }, [batchIndex, definitionOrder, elapsed, matched, missCount, onStateChange, selectedTerm, shuffled, startTime, totalMatched, wrongPair]);

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
      // Wrong match — track misses
      setMissCount(prev => ({
        ...prev,
        [selectedTerm]: (prev[selectedTerm] || 0) + 1,
        [cardId]: (prev[cardId] || 0) + 1,
      }));
      setWrongPair({ term: selectedTerm, def: cardId });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedTerm(null);
      }, 600);
    }
  }, [selectedTerm, matched, batch.length]);

  // Keyboard: Escape to quit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onQuit) onQuit();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onQuit]);

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
    // Fire session complete callback
    if (!sessionCompleteRef.current && onSessionComplete) {
      sessionCompleteRef.current = true;
      const totalMisses = Object.values(missCount).reduce((s, v) => s + v, 0);
      const correctOnFirst = shuffled.length - Object.keys(missCount).filter(k => missCount[k] > 0).length;
      const now = new Date().toISOString();
      onSessionComplete({
        session_type: 'test',
        cards_studied: shuffled.length,
        cards_correct: correctOnFirst,
        cards_incorrect: totalMisses,
        started_at: sessionStartRef.current,
        finished_at: now,
      });
    }

    // Find cards with most mismatches
    const hardestCards = shuffled
      .filter(c => (missCount[c.id] || 0) > 0)
      .sort((a, b) => (missCount[b.id] || 0) - (missCount[a.id] || 0))
      .slice(0, 5);

    return (
      <div className={styles.layout}>
        <div className={styles.results}>
          <h2>Matching complete!</h2>
          <div className={styles.score}>{formatTime(elapsed)}</div>
          <div className={styles.scoreLabel}>
            {shuffled.length} pairs matched
          </div>
          {hardestCards.length > 0 && (
            <div style={{ marginTop: '1rem', textAlign: 'left', width: '100%', maxWidth: 360 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--fg-muted)' }}>Most Missed</h3>
              {hardestCards.map(card => (
                <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600 }}>{(card.front || '').replace(/<[^>]*>/g, '')}</span>
                  <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{missCount[card.id]}× missed</span>
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
    );
  }

  const progress = (totalMatched / shuffled.length) * 100;

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Match {totalMatched}/{shuffled.length}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={styles.timer}>{formatTime(elapsed)}</span>
            {onQuit && (
              <button onClick={onQuit} title="Quit (Esc)" style={{
                background: 'none', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius)',
                color: 'var(--fg-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontFamily: 'inherit'
              }}>×</button>
            )}
          </div>
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
