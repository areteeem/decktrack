import styles from "./SpinWheel.module.css";
import ProgressBar from "../../common/components/ProgressBar";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/**
 * SpinWheel — "Game-show" spinning wheel that randomly picks a card.
 * After the wheel stops it zooms into the chosen card.
 * Remove hides the card from this session; Continue keeps it and spins again.
 */

const SEGMENT_FILLS = [
  "#e74c3c", // red
  "#2980b9", // blue
  "#27ae60", // green
  "#f1c40f", // yellow
  "#e67e22", // orange
  "#8e44ad", // purple
  "#16a085", // teal
  "#d35400", // burnt orange
];

const SpinWheel = ({ flashcards, onQuit, onSessionComplete }) => {
  const cards = useMemo(() => {
    if (!flashcards || flashcards.length === 0) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [spinning, setSpinning] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showCard, setShowCard] = useState(false); // zoom-in phase
  const [removed, setRemoved] = useState(new Set()); // hidden cards (session-only)
  const [continued, setContinued] = useState(0);
  const [winningSegIdx, setWinningSegIdx] = useState(null); // segment index for yellow blink
  const sessionStartRef = useRef(new Date().toISOString());

  const totalCards = cards.length;
  const remaining = totalCards - removed.size;
  const isComplete = remaining <= 0 && totalCards > 0;

  // Visible segments on the wheel (up to 12 non-removed cards)
  const segments = useMemo(() => {
    const pool = cards
      .map((c, i) => ({ card: c, idx: i }))
      .filter((item) => !removed.has(item.idx));
    return pool.slice(0, 12);
  }, [cards, removed]);

  const spin = useCallback(() => {
    if (spinning || segments.length === 0) return;
    setFlipped(false);
    setSelectedIdx(null);
    setShowCard(false);
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
      setSelectedIdx(segments[target].idx);
      setWinningSegIdx(target);
      // Yellow blink plays for ~600ms, then zoom in on the card
      setTimeout(() => setShowCard(true), 700);
    }, 3400);
  }, [spinning, segments, rotation]);

  const handleRemove = useCallback(() => {
    if (selectedIdx === null) return;
    setRemoved((prev) => new Set([...prev, selectedIdx]));
    setSelectedIdx(null);
    setFlipped(false);
    setShowCard(false);
    setWinningSegIdx(null);
  }, [selectedIdx]);

  const handleContinue = useCallback(() => {
    if (selectedIdx === null) return;
    setContinued((c) => c + 1);
    setSelectedIdx(null);
    setFlipped(false);
    setShowCard(false);
    setWinningSegIdx(null);
  }, [selectedIdx]);

  // Session complete
  useEffect(() => {
    if (isComplete && onSessionComplete) {
      onSessionComplete({
        session_type: "wheel",
        cards_studied: totalCards,
        cards_correct: continued,
        cards_incorrect: removed.size,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round(
          (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000
        ),
      });
    }
  }, [isComplete, totalCards, continued, removed.size, onSessionComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onQuit?.();
      if (e.key === " " && !spinning && selectedIdx === null && !isComplete) {
        e.preventDefault();
        spin();
      }
      if (e.key === "Enter" && selectedIdx !== null && !flipped) setFlipped(true);
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [spinning, selectedIdx, isComplete, flipped, spin, onQuit]);

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
              <span className={styles.statVal}>{removed.size}</span>
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
            <button className={styles.outlinedBtn} onClick={() => { setRemoved(new Set()); setContinued(0); setRotation(0); }}>Spin Again</button>
            <button className={styles.outlinedBtn} onClick={onQuit}>Finish</button>
          </div>
        </div>
      </div>
    );
  }

  const selectedCard = selectedIdx !== null ? cards[selectedIdx] : null;

  return (
    <div className={styles.wheelContainer}>
      {/* Header */}
      <div className={styles.header}>
        <ProgressBar current={removed.size} total={totalCards} />
        <span className={styles.progressText}>{remaining} left</span>
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

                // Radial text: reading outward from center along the segment midline
                const textRotation = midAngle; // degrees from 12 o'clock CW

                return (
                  <g key={seg.idx}>
                    <path
                      d={d}
                      fill={SEGMENT_FILLS[i % SEGMENT_FILLS.length]}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="0.5"
                    />
                    {winningSegIdx === i && (
                      <path
                        d={d}
                        className={styles.winSegment}
                        fill="rgba(255, 255, 255, 0.5)"
                        stroke="none"
                      />
                    )}
                    <text
                      x="100"
                      y="100"
                      textAnchor="start"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={count <= 6 ? "5.5" : count <= 10 ? "4.5" : "3.8"}
                      fontWeight="700"
                      letterSpacing="0.3"
                      style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
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
                return <circle key={`p${i}`} cx={px} cy={py} r="2.5" fill="#fff" stroke="#daa520" strokeWidth="0.5" />;
              })}
              {/* Center hub */}
              <circle
                cx="100"
                cy="100"
                r="20"
                fill="#fff"
                stroke="#b8860b"
                strokeWidth="3"
              />
              <circle
                cx="100"
                cy="100"
                r="15"
                fill="var(--card-bg, #fff)"
                stroke="#daa520"
                strokeWidth="1"
              />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#333"
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
