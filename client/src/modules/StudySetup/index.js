import { useState } from "react";
import styles from "./StudySetup.module.css";
import { useSettings } from "../../contexts/SettingsContext";

/**
 * Study session setup screen.
 * Lets users choose: card pool, study mode, side order, shuffle.
 */
const POOLS = [
  { id: "new", tKey: "newCards" },
  { id: "due", tKey: "dueCards" },
  { id: "mixed", tKey: "mixedPool" },
  { id: "hard", tKey: "hardCards" },
  { id: "all", tKey: "allCards" },
];

const MODES = [
  { id: "flashcards", tKey: "flashcards" },
  { id: "mcq", tKey: "multipleChoice" },
  { id: "fillblank", tKey: "fillBlank" },
  { id: "match", tKey: "matching" },
  { id: "quiz", tKey: "quiz" },
];

const SIDES = [
  { id: "term", tKey: "termToDef" },
  { id: "def", tKey: "defToTerm" },
  { id: "mixed", tKey: "mixed" },
];

const StudySetup = ({ newCount = 0, dueCount = 0, totalCount = 0, hardCount = 0, onStart }) => {
  const { t } = useSettings();
  const [pool, setPool] = useState("new");
  const [mode, setMode] = useState("flashcards");
  const [sideOrder, setSideOrder] = useState("term");
  const [shuffle, setShuffle] = useState(true);

  const poolCount = {
    new: newCount,
    due: dueCount,
    mixed: newCount + dueCount,
    hard: hardCount,
    all: totalCount,
  }[pool];

  const canStart = poolCount > 0;

  const handleStart = () => {
    if (!canStart) return;
    onStart({ pool, mode, sideOrder, shuffle });
  };

  return (
    <div className={styles.setup}>
      <h1>{t("studySession")}</h1>

      <div className={styles.cardCounts}>
        <span><strong>{newCount}</strong> {t("nNew")}</span>
        <span><strong>{dueCount}</strong> {t("nDue")}</span>
        <span><strong>{newCount + dueCount}</strong> {t("nMixed")}</span>
        <span><strong>{hardCount}</strong> {t("nHard")}</span>
        <span><strong>{totalCount}</strong> {t("nTotal")}</span>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("cardPool")}</span>
        <div className={styles.optionGroup}>
          {POOLS.map(p => (
            <button
              key={p.id}
              className={pool === p.id ? styles.optionBtnActive : styles.optionBtn}
              onClick={() => setPool(p.id)}
            >
              {t(p.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("studyMode")}</span>
        <div className={styles.optionGroup}>
          {MODES.map(m => (
            <button
              key={m.id}
              className={mode === m.id ? styles.optionBtnActive : styles.optionBtn}
              onClick={() => setMode(m.id)}
            >
              {t(m.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("sideOrder")}</span>
        <div className={styles.optionGroup}>
          {SIDES.map(s => (
            <button
              key={s.id}
              className={sideOrder === s.id ? styles.optionBtnActive : styles.optionBtn}
              onClick={() => setSideOrder(s.id)}
            >
              {t(s.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.toggleRow}>
        <div
          className={shuffle ? styles.toggleOn : styles.toggle}
          onClick={() => setShuffle(!shuffle)}
        />
        <span className={styles.toggleLabel}>{t("shuffleCards")}</span>
      </div>

      <button
        className={styles.startBtn}
        onClick={handleStart}
        disabled={!canStart}
      >
        {canStart ? t("startN", { n: poolCount }) : t("noCardsAvailable")}
      </button>
    </div>
  );
};

export default StudySetup;
