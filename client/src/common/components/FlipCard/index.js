import { useEffect, useRef } from "react";
import styles from "./FlipCard.module.css";
import { useSettings } from "../../../contexts/SettingsContext";

const FlipCard = ({ flashcard, isFlipped, setIsFlipped, showTermFirst = true, onSwipeLeft, onSwipeRight }) => {
  const { t } = useSettings();
  const touchRef = useRef({ startX: 0, startY: 0 });

  const onKeyPressed = (e) => {
    if (e.key === " ") {
      e.preventDefault();
      setIsFlipped(true);
      window.removeEventListener("keydown", onKeyPressed, true);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", onKeyPressed, true);
    return () => {
      window.removeEventListener("keydown", onKeyPressed, true);
    };
  });

  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!isFlipped) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && onSwipeLeft) onSwipeLeft();
      if (dx > 0 && onSwipeRight) onSwipeRight();
    }
  };

  // Highlight term occurrences in text (definition or example) with yellow background
  const boldTermIn = (text, term) => {
    if (!text || !term) return text;
    const plainTerm = (term || "").replace(/<[^>]*>/g, "").trim();
    if (!plainTerm) return text;
    const regex = new RegExp(`(${plainTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={{ background: 'var(--badge-bg)', borderRadius: 2, padding: '0 2px' }}>{part}</mark> : part
    );
  };

  // Highlight term occurrences in example sentence
  const renderExample = (example, term) => {
    if (!example || !term) return null;
    const plainTerm = (term || "").replace(/<[^>]*>/g, "").trim();
    if (!plainTerm) return <p className={styles.example}>{example}</p>;
    const regex = new RegExp(`(${plainTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = example.split(regex);
    return (
      <p className={styles.example}>
        {parts.map((part, i) =>
          regex.test(part) ? <mark key={i} style={{ background: 'var(--badge-bg)', borderRadius: 2, padding: '0 2px' }}>{part}</mark> : part
        )}
      </p>
    );
  };

  const frontSide = showTermFirst ? flashcard.front : flashcard.back;
  const backSide = showTermFirst ? flashcard.back : flashcard.front;
  const frontLabel = showTermFirst ? t("term") : t("definition");
  const backLabel = showTermFirst ? t("definition") : t("term");

  // Check if content contains HTML tags
  const hasHtml = (str) => /<[a-z][\s\S]*>/i.test(str || "");

  return (
    <div
      className={styles.flipCard}
      onClick={() => setIsFlipped(true)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.front}>
        <span className={styles.sideLabel}>{frontLabel}</span>
        {hasHtml(frontSide)
          ? <h2 dangerouslySetInnerHTML={{ __html: frontSide }} />
          : <h2>{frontSide}</h2>
        }
      </div>
      {!isFlipped ? (
        <div className={styles.nextSide}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
            />
          </svg>
          <h4>Next Side</h4>
          <code>Space</code>
        </div>
      ) : (
        <div className={styles.back}>
          <span className={styles.sideLabel}>{backLabel}</span>
          {hasHtml(backSide)
            ? <h3 dangerouslySetInnerHTML={{ __html: backSide }} />
            : <h3>{boldTermIn(backSide, flashcard.front) || backSide}</h3>
          }
          {flashcard.example_sentence && (
            hasHtml(flashcard.example_sentence)
              ? <p className={styles.example} dangerouslySetInnerHTML={{ __html: flashcard.example_sentence }} />
              : renderExample(flashcard.example_sentence, flashcard.front)
          )}
        </div>
      )}
    </div>
  );
};

export default FlipCard;
