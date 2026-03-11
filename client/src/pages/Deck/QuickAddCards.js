import { useState, useRef } from "react";
import { toast } from "react-toastify";
import { useCreateCard } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import styles from "./QuickAddCards.module.css";

const QuickAddCards = ({ deckId, onAdded, embedded }) => {
  const { createCard } = useCreateCard();
  const { t } = useSettings();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const frontRef = useRef(null);

  const handleAdd = async () => {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      await createCard({
        front: front.trim(),
        back: back.trim(),
        deck_id: deckId,
      });
      setAddedCount((c) => c + 1);
      setFront("");
      setBack("");
      frontRef.current?.focus();
      onAdded?.();
    } catch (err) {
      toast.error(err.message || t("failedAdd"));
    }
    setSaving(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const content = (
    <>
      {!embedded && (
        <div className={styles.header}>
          <h3>{t("quickAdd")}</h3>
        </div>
      )}
      <div className={styles.form}>
        <div className={styles.inputGroup}>
          <label>{t("termInput")}</label>
          <input
            ref={frontRef}
            value={front}
            onChange={(e) => setFront(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${t("termInput")}...`}
            autoFocus
          />
        </div>
        <div className={styles.inputGroup}>
          <label>{t("definitionInput")}</label>
          <input
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${t("definitionInput")}...`}
          />
        </div>
        <button
          className={styles.addBtn}
          onClick={handleAdd}
          disabled={saving || !front.trim() || !back.trim()}
        >
          {saving ? "..." : t("add")}
        </button>
      </div>
      <p className={styles.hint}>{t("pressEnter")}</p>
      {addedCount > 0 && (
        <p className={styles.added}>{addedCount} {t("nCardsAdded", { n: addedCount })}</p>
      )}
    </>
  );

  if (embedded) return content;
  return <div className={styles.wrapper}>{content}</div>;
};

export default QuickAddCards;
