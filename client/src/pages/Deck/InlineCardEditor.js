import { useState } from "react";
import { toast } from "react-toastify";
import RichTextInput from "../../common/components/RichTextInput";
import Button from "../../common/components/Button";
import { useCreateCard } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import styles from "./InlineCardEditor.module.css";

const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

const InlineCardEditor = ({ deckId, onSaved }) => {
  const { createCard } = useCreateCard();
  const { t } = useSettings();

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!stripHtml(front) || !stripHtml(back)) {
      toast.error(t("bothRequired"));
      return;
    }
    setSaving(true);
    try {
      await createCard({
        front: front.trim(),
        back: back.trim(),
        deck_id: deckId,
      });
      setFront("");
      setBack("");
      onSaved?.();
      toast.success(t("saveCard") + " ✓");
    } catch (err) {
      toast.error(err.message || t("failedSave"));
    }
    setSaving(false);
  };

  return (
    <form className={styles.form} onSubmit={handleSave}>
      <div className={styles.row}>
        <RichTextInput
          label={t("term")}
          placeholder={t("termPlaceholder")}
          value={front}
          onChange={setFront}
        />
        <button
          type="button"
          className={styles.swapBtn}
          onClick={() => { setFront(back); setBack(front); }}
          title="Swap"
        >
          ⇄
        </button>
        <RichTextInput
          label={t("definition")}
          placeholder={t("definitionPlaceholder")}
          value={back}
          onChange={setBack}
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("saveCard")}
        </Button>
      </div>
    </form>
  );
};

export default InlineCardEditor;
