import styles from "./SpinWheel.module.css";
import ProgressBar from "../../common/components/ProgressBar";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/**
 * SpinWheel study mode — Wordwall-style spinning wheel.
 * Spins to a random card, student flips to see the answer,
 * then self-grades correct / wrong.
 */

const WHEEL_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
  "#14b8a6", "#6366f1", "#84cc16", "#e11d48",
];

const SpinWheel = ({ flashcards, onQuit, onSessionComplete }) => {
  const cards = useMemo(() => {
    if (!flashcards || flashcards.length === 0) return [];
    return [...flashcards].sort(() => Math.random() - 0.5);
  }, [flashcards]);

  const [round, setRound] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answered, setAnswered] = useState(new Set());
  const sessionStartRef = useRef(new Date().toISOString());

  const totalCards = cards.length;
  const isComplete = answered.size >= totalCards;

  // Visible segments on the wheel (up to 12 unanswered cards)
  const segments = useMemo(() => {
    const remaining = cards
      .map((c, i) => ({ card: c, idx: i }))
      .filter((item) => !answered.has(item.idx));
    return remaining.slice(0, 12);
  }, [cards, answered]);

  const spin = useCallback(() => {
    if (spinning || segments.length === 0) return;
    setFlipped(false);
    setSelectedIdx(null);
    setSpinning(true);

    // Pick random segment
    const target = Math.floor(Math.random() * segments.length);
    const segAngle = 360 / segments.length;
    // Land in the middle of the target segment
    const targetAngle = target * segAngle + segAngle / 2;
    // Spin multiple full rotations + land at target
    const fullSpins = 4 + Math.floor(Math.random() * 3);
    const finalRotation = rotation + fullSpins * 360 + (360 - targetAngle);

    setRotation(finalRotation);

    setTimeout(() => {
      setSpinning(false);
      setSelectedIdx(segments[target].idx);
    }, 3200);
  }, [spinning, segments, rotation]);

  const handleGrade = useCallback((correct) => {
    if (selectedIdx === null) return;
    setAnswered((prev) => new Set([...prev, selectedIdx]));
    if (correct) setCorrectCount((c) => c + 1);
    else setWrongCount((c) => c + 1);
    setSelectedIdx(null);
    setFlipped(false);
    setRound((r) => r + 1);
  }, [selectedIdx]);

  // Session complete callback
  useEffect(() => {
    if (isComplete && onSessionComplete && totalCards > 0) {
      onSessionComplete({
        session_type: "wheel",
        cards_studied: totalCards,
        cards_correct: correctCount,
        cards_incorrect: wrongCount,
        started_at: sessionStartRef.current,
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - new Date(sessionStartRef.current).getTime()) / 1000),
      });
    }
  }, [isComplete, totalCards, correctCount, wrongCount, onSessionComplete]);

  // Keyboard: Escape to quit, Space to spin, Enter to flip
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onQuit?.();
      if (e.key === " " && !spinning && selectedIdx === null && !isComplete) { e.preventDefault(); spin(); }
      if (e.key === "Enter" && selectedIdx !== null && !flipped) setFlipped(true);
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [spinning, selectedIdx, isComplete, flipped, spin, onQuit]);

  if (!cards.length) {
    return (
      <div className={styles.wheelContainer}>
        <p>No cards to study.</p>
        <button className={styles.quitBtn} onClick={onQuit}>Go back</button>
      </div>
    );
  }

  if (isComplete) {
    const accuracy = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
    return (
      <div className={styles.wheelContainer}>
        <div className={styles.completeSummary}>
          <h2>🎉 All Done!</h2>
          <div className={styles.stats}>
            <span>✅ {correctCount} correct</span>
            <span>❌ {wrongCount} wrong</span>
            <span>📊 {accuracy}%</span>
          </div>
          <button className={styles.quitBtn} onClick={onQuit}>Finish</button>
        </div>
      </div>
    );
  }

  const selectedCard = selectedIdx !== null ? cards[selectedIdx] : null;

  return (
    <div className={styles.wheelContainer}>
      <div className={styles.header}>
        <ProgressBar current={answered.size} total={totalCards} />
        <span className={styles.progressText}>{answered.size}/{totalCards}</span>
      </div>

      {/* Wheel */}
      <div className={styles.wheelWrapper}>
        <div className={styles.pointer} />
        <svg
          className={`${styles.wheelSvg} ${spinning ? styles.spinning : ""}`}
          viewBox="0 0 200 200"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {segments.map((seg, i) => {
            const count = segments.length;
            const angle = 360 / count;
            const startAngle = i * angle;
            const endAngle = startAngle + angle;
            const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
            const r = 100;
            const x1 = 100 + r * Math.cos(toRad(startAngle));
            const y1 = 100 + r * Math.sin(toRad(startAngle));
            const x2 = 100 + r * Math.cos(toRad(endAngle));
            const y2 = 100 + r * Math.sin(toRad(endAngle));
            const largeArc = angle > 180 ? 1 : 0;
            const d = `M100,100 L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;

            // Label positioning
            const midAngle = startAngle + angle / 2;
            const labelR = 60;
            const lx = 100 + labelR * Math.cos(toRad(midAngle));
            const ly = 100 + labelR * Math.sin(toRad(midAngle));

            const term = String(seg.card.front || seg.card.term || "").slice(0, 12);

            return (
              <g key={seg.idx}>
                <path d={d} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#fff" strokeWidth="1" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={count <= 6 ? "7" : "5"}
                  fontWeight="600"
                  style={{ pointerEvents: "none" }}
                  transform={`rotate(${midAngle}, ${lx}, ${ly})`}
                >
                  {term}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="16" fill="var(--bg, #fff)" stroke="#ddd" strokeWidth="1" />
        </svg>
      </div>

      {/* Controls */}
      {selectedCard === null && (
        <button className={styles.spinBtn} onClick={spin} disabled={spinning}>
          {spinning ? "Spinning…" : "🎡 Spin!"}
        </button>
      )}

      {/* Card reveal area */}
      {selectedCard && (
        <>
          <div className={styles.cardReveal} onClick={() => setFlipped((f) => !f)}>
            <div className={styles.cardTerm}>{selectedCard.front || selectedCard.term}</div>
            {flipped && <div className={styles.cardDef}>{selectedCard.back || selectedCard.definition}</div>}
            {!flipped && <div className={styles.flipHint}>Tap to reveal answer</div>}
          </div>
          {flipped && (
            <div className={styles.resultBtns}>
              <button className={`${styles.resultBtn} ${styles.correct}`} onClick={() => handleGrade(true)}>✅ Knew it</button>
              <button className={`${styles.resultBtn} ${styles.wrong}`} onClick={() => handleGrade(false)}>❌ Didn't know</button>
            </div>
          )}
        </>
      )}

      <button className={styles.quitBtn} onClick={onQuit}>Quit</button>
    </div>
  );
};

export default SpinWheel;
