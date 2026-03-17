import styles from "./SpinWheel.module.css";
import ProgressBar from "../../common/components/ProgressBar";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/**
 * SpinWheel — "Game-show" spinning wheel that randomly picks a card.
 * After the wheel stops it zooms into the chosen card.
 * Remove hides the card from this session; Continue keeps it and spins again.
 */

const SEGMENT_FILLS = [
  "var(--wheel-segment-1)",
  "var(--wheel-segment-2)",
  "var(--wheel-segment-3)",
  "var(--wheel-segment-4)",
  "var(--wheel-segment-1)",
  "var(--wheel-segment-2)",
  "var(--wheel-segment-3)",
  "var(--wheel-segment-4)",
];

const SpinWheel = ({ flashcards, onQuit, onSessionComplete, sessionState, onStateChange }) => {
  const cards = useMemo(() => flashcards || [], [flashcards]);
  const restoredStateRef = useRef({
    selectedCardId: sessionState?.selectedCardId ?? null,
    flipped: Boolean(sessionState?.flipped),
    rotation: Number(sessionState?.rotation || 0),
    showCard: Boolean(sessionState?.showCard),
    removedIds: Array.isArray(sessionState?.removedIds) ? sessionState.removedIds : [],
    continued: Number(sessionState?.continued || 0),
    winningSegIdx: typeof sessionState?.winningSegIdx === "number" ? sessionState.winningSegIdx : null,
    cardShownAt: sessionState?.cardShownAt || null,
    sessionStartedAt: sessionState?.sessionStartedAt || new Date().toISOString(),
  });

  const [spinning, setSpinning] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(restoredStateRef.current.selectedCardId);
  const [flipped, setFlipped] = useState(restoredStateRef.current.flipped);
  const [rotation, setRotation] = useState(restoredStateRef.current.rotation);
  const [showCard, setShowCard] = useState(restoredStateRef.current.showCard); // zoom-in phase
  const [removedIds, setRemovedIds] = useState(restoredStateRef.current.removedIds);
  const [continued, setContinued] = useState(restoredStateRef.current.continued);
  const [winningSegIdx, setWinningSegIdx] = useState(restoredStateRef.current.winningSegIdx); // segment index for yellow blink
  const [cardShownAt, setCardShownAt] = useState(restoredStateRef.current.cardShownAt);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (!restoredStateRef.current.showCard || !restoredStateRef.current.cardShownAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(restoredStateRef.current.cardShownAt).getTime()) / 1000));
  });
  const sessionStartRef = useRef(restoredStateRef.current.sessionStartedAt);
  const sessionCompleteRef = useRef(false);

  const removedIdSet = useMemo(
    () => new Set((removedIds || []).map((cardId) => String(cardId))),
    [removedIds]
  );

  const totalCards = cards.length;
  const remaining = totalCards - removedIds.length;
  const isComplete = remaining <= 0 && totalCards > 0;

  // Visible segments on the wheel (up to 12 non-removed cards)
  const segments = useMemo(() => {
    const pool = cards
      .map((c, i) => ({ card: c, idx: i }))
      .filter((item) => !removedIdSet.has(String(item.card.id)));
    return pool.slice(0, 12);
  }, [cards, removedIdSet]);

  const selectedCard = useMemo(
    () => cards.find((card) => String(card.id) === String(selectedCardId)) || null,
    [cards, selectedCardId]
  );

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      completedIds: removedIds,
      currentIndex: removedIds.length,
      stats: {
        reviewed: removedIds.length + continued,
        correct: continued,
        incorrect: removedIds.length,
      },
      modeState: {
        selectedCardId,
        flipped,
        rotation,
        showCard,
        removedIds,
        continued,
        winningSegIdx,
        cardShownAt,
        sessionStartedAt: sessionStartRef.current,
      },
    });
  }, [cardShownAt, continued, flipped, onStateChange, removedIds, rotation, selectedCardId, showCard, winningSegIdx]);

  // Stopwatch timer - starts when card is shown
  useEffect(() => {
    if (showCard && selectedCardId !== null && !cardShownAt) {
      setCardShownAt(new Date().toISOString());
      setElapsedSeconds(0);
    }
    if ((!showCard || selectedCardId === null) && cardShownAt) {
      setCardShownAt(null);
      setElapsedSeconds(0);
    }
  }, [cardShownAt, selectedCardId, showCard]);

  // Update elapsed seconds every second while card is visible
  useEffect(() => {
    if (!showCard || selectedCardId === null || !cardShownAt) return;

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(cardShownAt).getTime()) / 1000)));
    };

    updateElapsed();
    const interval = setInterval(() => {
      updateElapsed();
    }, 100); // Update 10x per second for smoothness

    return () => clearInterval(interval);
  }, [cardShownAt, selectedCardId, showCard]);

  const spin = useCallback(() => {
    if (spinning || segments.length === 0) return;
    setFlipped(false);
    setSelectedCardId(null);
    setShowCard(false);
    setCardShownAt(null);
    setWinningSegIdx(null);
    setSpinning(true);

    const target = Math.floor(Math.random() * segments.length);
    const segAngle = 360 / segments.length;
    const targetAngle = target * segAngle + segAngle / 2;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    // Pointer is at top (12 o'clock). CSS rotate(R°) turns wheel CW by R°,
    // so the segment originally at (360 − R)° from top ends under the pointer.
    // We need finalRotation % 360 === 360 − targetAngle.
    const stopAngle = ((360 - targetAngle) % 360 + 360) % 360;
    const currentAngle = ((rotation % 360) + 360) % 360;
    const extra = ((stopAngle - currentAngle) % 360 + 360) % 360;
    const finalRotation = rotation + fullSpins * 360 + extra;

    setRotation(finalRotation);

    // After spin settles, highlight winning segment then reveal card
    setTimeout(() => {
      setSpinning(false);
      setSelectedCardId(segments[target].card.id);
      setWinningSegIdx(target);
      // Yellow blink plays for ~600ms, then zoom in on the card
      setTimeout(() => setShowCard(true), 700);
    }, 3400);
  }, [spinning, segments, rotation]);

  const handleRemove = useCallback(() => {
    if (selectedCardId === null) return;
    setRemovedIds((prev) => Array.from(new Set([...(prev || []), selectedCardId])));
    setSelectedCardId(null);
    setFlipped(false);
    setShowCard(false);
    setWinningSegIdx(null);
    setCardShownAt(null);
    setElapsedSeconds(0);
  }, [selectedCardId]);

  const handleContinue = useCallback(() => {
    if (selectedCardId === null) return;
    setContinued((c) => c + 1);
    setSelectedCardId(null);
    setFlipped(false);
    setShowCard(false);
    setWinningSegIdx(null);
    setCardShownAt(null);
    setElapsedSeconds(0);
  }, [selectedCardId]);

  // Session complete
  useEffect(() => {
    if (isComplete && onSessionComplete && !sessionCompleteRef.current) {
      sessionCompleteRef.current = true;
      onSessionComplete({
        session_type: "wheel",
        cards_studied: totalCards,
        cards_correct: continued,
        cards_incorrect: removedIds.length,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round(
          (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000
        ),
      });
    }
  }, [continued, isComplete, onSessionComplete, removedIds.length, totalCards]);

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onQuit?.();
      if (e.key === " " && !spinning && selectedCardId === null && !isComplete) {
        e.preventDefault();
        spin();
      }
      if (e.key === "Enter" && selectedCardId !== null && !flipped) setFlipped(true);
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [flipped, isComplete, onQuit, selectedCardId, spin, spinning]);

  if (!cards.length) {
    return (
      <div className={styles.wheelContainer}>
        <p>No cards to study.</p>
        <button className={styles.outlinedBtn} onClick={onQuit}>Go back</button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className={styles.wheelContainer}>
        <div className={styles.completeSummary}>
          <h2>All Done!</h2>
          <div className={styles.statsRow}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Removed</span>
              <span className={styles.statVal}>{removedIds.length}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Continued</span>
              <span className={styles.statVal}>{continued}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statVal}>{totalCards}</span>
            </span>
          </div>
          <div className={styles.completeBtns}>
            <button className={styles.outlinedBtn} onClick={() => { setRemovedIds([]); setContinued(0); setRotation(0); setSelectedCardId(null); setShowCard(false); setFlipped(false); setWinningSegIdx(null); setCardShownAt(null); setElapsedSeconds(0); sessionCompleteRef.current = false; }}>Spin Again</button>
            <button className={styles.outlinedBtn} onClick={onQuit}>Finish</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wheelContainer}>
      {/* Header */}
      <div className={styles.header}>
        <ProgressBar current={removedIds.length} total={totalCards} />
        <span className={styles.progressText}>{remaining} left</span>
        {showCard && selectedCardId !== null && (
          <div className={styles.stopwatch}>
            {elapsedSeconds}s
          </div>
        )}
      </div>

      {/* Wheel + zoom overlay */}
      <div className={`${styles.wheelArea} ${showCard ? styles.wheelShrunk : ""}`}>
        <div className={styles.wheelWrapper}>
          <div className={styles.pointer} />
          <div className={styles.wheelRing}>
            <svg
              className={styles.wheelSvg}
              viewBox="0 0 200 200"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {segments.map((seg, i) => {
                const count = segments.length;
                const angle = 360 / count;
                const startAngle = i * angle;
                const endAngle = startAngle + angle;
                const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
                const r = 97;
                const x1 = 100 + r * Math.cos(toRad(startAngle));
                const y1 = 100 + r * Math.sin(toRad(startAngle));
                const x2 = 100 + r * Math.cos(toRad(endAngle));
                const y2 = 100 + r * Math.sin(toRad(endAngle));
                const largeArc = angle > 180 ? 1 : 0;
                const d = `M100,100 L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;

                const midAngle = startAngle + angle / 2;
                const term = String(seg.card.front || seg.card.term || "").slice(0, 18);

                return (
                  <g key={seg.idx}>
                    <path
                      d={d}
                      fill={SEGMENT_FILLS[i % SEGMENT_FILLS.length]}
                      stroke="var(--wheel-outline)"
                      strokeWidth="0.8"
                    />
                    {winningSegIdx === i && (
                      <path
                        d={d}
                        className={styles.winSegment}
                        fill="var(--wheel-highlight)"
                        stroke="none"
                      />
                    )}
                    <text
                      x="100"
                      y="100"
                      textAnchor="start"
                      dominantBaseline="central"
                      fill="var(--wheel-text)"
                      fontSize={count <= 6 ? "5.5" : count <= 10 ? "4.5" : "3.8"}
                      fontWeight="600"
                      letterSpacing="0.25"
                      style={{ pointerEvents: "none" }}
                      transform={`rotate(${midAngle - 90}, 100, 100) translate(24, 0)`}
                    >
                      {term}
                    </text>
                  </g>
                );
              })}
              {/* Rim pegs */}
              {segments.map((_, i) => {
                const pa = i * (360 / segments.length);
                const px = 100 + 96 * Math.cos(((pa - 90) * Math.PI) / 180);
                const py = 100 + 96 * Math.sin(((pa - 90) * Math.PI) / 180);
                return <circle key={`p${i}`} cx={px} cy={py} r="2.2" fill="var(--wheel-peg-fill)" stroke="var(--wheel-outline)" strokeWidth="0.55" />;
              })}
              {/* Center hub */}
              <circle
                cx="100"
                cy="100"
                r="20"
                fill="var(--wheel-hub-bg)"
                stroke="var(--wheel-outline-strong)"
                strokeWidth="2.4"
              />
              <circle
                cx="100"
                cy="100"
                r="15"
                fill="var(--wheel-hub-inner)"
                stroke="var(--wheel-outline)"
                strokeWidth="0.9"
              />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--wheel-hub-text)"
                fontSize="7"
                fontWeight="700"
              >
                {remaining}
              </text>
            </svg>
          </div>
        </div>

        {/* Spin button (only when no card is selected) */}
        {selectedCard === null && (
          <button
            className={styles.spinBtn}
            onClick={spin}
            disabled={spinning}
          >
            {spinning ? "Spinning\u2026" : "Spin!"}
          </button>
        )}
      </div>

      {/* Card zoom-in overlay */}
      {selectedCard && showCard && (
        <div className={styles.cardOverlay}>
          <div
            className={`${styles.cardReveal} ${styles.cardFocused} ${flipped ? styles.cardFlipped : ""}`}
            onClick={() => !flipped && setFlipped(true)}
          >
            <div className={styles.cardFront}>
              <div className={styles.cardTerm}>
                {selectedCard.front || selectedCard.term}
              </div>
              {!flipped && (
                <div className={styles.flipHint}>Tap to reveal</div>
              )}
            </div>
            {flipped && (
              <div className={styles.cardBack}>
                <div className={styles.cardDef}>
                  {selectedCard.back || selectedCard.definition}
                </div>
                {selectedCard.example_sentence && (
                  <div className={styles.cardExample}>
                    {selectedCard.example_sentence}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom action buttons */}
          <div className={styles.actionBtns}>
            <button
              className={`${styles.outlinedBtn} ${styles.removeBtn}`}
              onClick={handleRemove}
            >
              Remove
            </button>
            <button
              className={`${styles.outlinedBtn} ${styles.continueBtn}`}
              onClick={handleContinue}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Quit */}
      <button className={styles.quitBtn} onClick={onQuit}>Quit</button>
    </div>
  );
};

export default SpinWheel;
