import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Button from "../../common/components/Button";
import { useCreateCardsBulk, useCreateDeck } from "../../hooks/useSupabaseData";
import styles from "./WordlyImport.module.css";

const MAX_IMPORTED_CARDS = 2000;

const readPayload = () => {
  const encodedPayload = new URLSearchParams(window.location.search).get("payload");
  if (!encodedPayload) return { name: "Wordly vocabulary", cards: [], error: "This import link does not contain any Wordly words." };

  try {
    const payload = JSON.parse(encodedPayload);
    if (payload?.source !== "wordly" || payload?.version !== 1) {
      throw new Error("This link is not a supported Wordly import.");
    }

    const cards = (Array.isArray(payload.cards) ? payload.cards : [])
      .map((card) => ({
        front: String(card?.front || "").trim(),
        back: String(card?.back || "").trim(),
        example_sentence: String(card?.example_sentence || "").trim(),
        notes: String(card?.notes || "").trim(),
      }))
      .filter((card) => card.front && card.back)
      .slice(0, MAX_IMPORTED_CARDS);

    if (!cards.length) {
      throw new Error("No complete word and translation pairs were found in this link.");
    }

    return {
      name: String(payload.name || "Wordly vocabulary").trim() || "Wordly vocabulary",
      cards,
      error: "",
    };
  } catch (error) {
    return {
      name: "Wordly vocabulary",
      cards: [],
      error: error.message || "Could not read this Wordly import link.",
    };
  }
};

const WordlyImport = () => {
  const navigate = useNavigate();
  const initialPayload = useMemo(readPayload, []);
  const [deckName, setDeckName] = useState(initialPayload.name);
  const [cards, setCards] = useState(initialPayload.cards);
  const [saving, setSaving] = useState(false);
  const { createDeck } = useCreateDeck();
  const { createCardsBulk } = useCreateCardsBulk();

  const removeCard = (indexToRemove) => {
    setCards((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleConfirm = async () => {
    const name = deckName.trim();
    if (!name) {
      toast.error("Give the new deck a name first.");
      return;
    }
    if (!cards.length) {
      toast.error("Keep at least one word to create the deck.");
      return;
    }

    setSaving(true);
    try {
      const deck = await createDeck({ name });
      await createCardsBulk(cards.map((card, index) => ({
        ...card,
        deck_id: deck.id,
        sort_order: index,
      })));
      toast.success(`${cards.length} words imported into “${name}”.`);
      navigate(`/deck/${deck.id}`, { replace: true });
    } catch (error) {
      toast.error(error.message || "Could not create the deck.");
      setSaving(false);
    }
  };

  if (initialPayload.error) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Wordly import</p>
          <h1>We couldn’t read these words</h1>
          <p className={styles.muted}>{initialPayload.error}</p>
          <Button callback={() => navigate("/")}>Back to Decks</Button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Wordly import</p>
            <h1>Review your words</h1>
            <p className={styles.muted}>
              Nothing is saved yet. Remove anything you do not want, name the new deck, then confirm.
            </p>
          </div>
          <span className={styles.count}>{cards.length} word{cards.length === 1 ? "" : "s"}</span>
        </div>

        <label className={styles.nameField}>
          <span>New deck name</span>
          <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
        </label>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Word</th><th>Translation</th><th>Context</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {cards.map((card, index) => (
                <tr key={`${card.front}-${index}`}>
                  <td>{card.front}</td>
                  <td>{card.back}</td>
                  <td>{card.example_sentence || "—"}</td>
                  <td><button type="button" className={styles.remove} onClick={() => removeCard(index)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.actions}>
          <Button callback={() => navigate("/")} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button callback={handleConfirm} disabled={saving || !cards.length}>
            {saving ? "Creating deck…" : `Confirm and import ${cards.length} word${cards.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </section>
    </main>
  );
};

export default WordlyImport;
