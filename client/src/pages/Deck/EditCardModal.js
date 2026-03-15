import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Button from "../../common/components/Button";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import RichTextInput from "../../common/components/RichTextInput";
import { useCreateCard, useDeleteCard, useUpdateCard } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import styles from "./EditCardModal.module.css";

const CARD_TYPE_OPTIONS = [
  { id: "normal", label: "Normal" },
  { id: "fill_blank", label: "Fill-in-the-blank" },
];

const EMPTY_CARD = {
  id: "",
  front: "",
  back: "",
  example_sentence: "",
  notes: "",
  card_type: "normal",
};

const EditCardModal = ({ open, flashcard = EMPTY_CARD, setOpen, deckId, onSaved }) => {
  const { createCard } = useCreateCard();
  const { updateCard } = useUpdateCard();
  const { deleteCard } = useDeleteCard();
  const { t } = useSettings();

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [notes, setNotes] = useState("");
  const [cardType, setCardType] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isFillBlank = cardType === "fill_blank";

  useEffect(() => {
    setFront(flashcard?.front || "");
    setBack(flashcard?.back || "");
    setExampleSentence(flashcard?.example_sentence || "");
    setNotes(flashcard?.notes || "");
    setCardType(flashcard?.card_type || "normal");
  }, [flashcard, open]);

  const handleSave = async (event) => {
    event.preventDefault();

    if (!front.trim() || !back.trim()) {
      toast.error(t("bothRequired"));
      return;
    }

    setSaving(true);

    try {
      const payload = {
        front: front.trim(),
        back: back.trim(),
        example_sentence: exampleSentence.trim(),
        notes: notes.trim(),
        card_type: cardType,
      };

      if (flashcard?.id) {
        await updateCard(flashcard.id, payload);
      } else {
        await createCard({ ...payload, deck_id: deckId });
      }
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || t("failedSave"));
    }

    setSaving(false);
  };

  const handleDelete = async (event) => {
    event.preventDefault();
    if (!flashcard?.id) return;

    setDeleting(true);
    try {
      await deleteCard(flashcard.id);
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || t("failedDelete"));
    }
    setDeleting(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} contentClassName={styles.modal}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>{t("cardEditor")}</span>
        <h2>{flashcard?.id ? t("editFlashcard") : t("createFlashcard")}</h2>
        <p>{t("editorDesc")}</p>
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        {/* Card type selector */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
          {CARD_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCardType(opt.id)}
              style={{
                padding: '0.35rem 0.7rem',
                border: `1.5px solid ${cardType === opt.id ? 'var(--fg)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius)',
                background: cardType === opt.id ? 'var(--fg)' : 'var(--card-bg)',
                color: cardType === opt.id ? 'var(--bg)' : 'var(--fg-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <TextInput
          label={isFillBlank ? "Sentence with blank" : t("term")}
          placeholder={isFillBlank ? "The capital of France is ___." : t("termPlaceholder")}
          helperText={isFillBlank ? "Use ___ where the blank should be" : t("termHelper")}
          state={front}
          setState={setFront}
        />
        {!isFillBlank && (
          <div className={styles.toolbar}>
            <Button
              type="button"
              callback={() => {
                setFront(back);
                setBack(front);
              }}
            >
              {t("swapSides")}
            </Button>
          </div>
        )}
        <RichTextInput
          label={isFillBlank ? "Correct answer" : t("definition")}
          placeholder={isFillBlank ? "Paris" : t("definitionPlaceholder")}
          helperText={isFillBlank ? "The answer that fills the blank" : t("definitionHelper")}
          multiline
          rows={isFillBlank ? 2 : 5}
          value={back}
          onChange={setBack}
        />
        <RichTextInput
          label={t("exampleSentence")}
          placeholder={t("examplePlaceholder")}
          helperText={t("exampleHelper")}
          multiline
          rows={3}
          value={exampleSentence}
          onChange={setExampleSentence}
        />
        <RichTextInput
          label={t("teacherNotes")}
          placeholder={t("notesPlaceholder")}
          helperText={t("notesHelper")}
          multiline
          rows={3}
          value={notes}
          onChange={setNotes}
        />

        <div className={styles.tipBox}>
          <strong>Tip:</strong> {t("tipBulkImport")}
        </div>

        <div className={styles.actions}>
          {flashcard?.id ? (
            <Button callback={handleDelete} disabled={deleting} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
              {deleting ? t("deleting") : t("deleteCard")}
            </Button>
          ) : <span />}
          <div className={styles.primaryActions}>
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveCard")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditCardModal;
