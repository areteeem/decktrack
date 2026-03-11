import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./Student.module.css";
import LoadingScreen from "../../common/components/LoadingScreen";
import Button from "../../common/components/Button";
import Badge from "../../common/components/Badge";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import RichTextInput from "../../common/components/RichTextInput";
import {
  useStudentDeckCards,
  useAssignments,
  useCreateStudentCard,
  useDeleteStudentCard,
  useUpdateStudentCardContent,
  useToggleFavorite,
} from "../../hooks/useSupabaseData";

/* ────────────────────── helpers ────────────────────── */
const FILTERS = ["all", "new", "learning", "mastered", "due", "custom", "favorite"];

const getCardStatus = (card) => {
  if (card.mastered) return "mastered";
  if (card.is_new) return "new";
  if (new Date(card.due) < new Date()) return "due";
  return "learning";
};

/* Status labels only — no colors, B/W design */

/* ────────────────── Add / Edit Card Modal ────────────── */
const CardFormModal = ({ open, setOpen, card, onSave, saving }) => {
  const [front, setFront] = useState(card?.front || "");
  const [back, setBack] = useState(card?.back || "");

  const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

  const handleSave = () => {
    if (!front.trim() || !stripHtml(back)) {
      toast.error("Both front and back are required.");
      return;
    }
    onSave({ front: front.trim(), back: back.trim() });
  };

  // Reset when opening
  useState(() => {
    if (open) {
      setFront(card?.front || "");
      setBack(card?.back || "");
    }
  }, [open, card]);

  return (
    <Modal open={open} setOpen={setOpen}>
      <h3>{card ? "Edit Card" : "Add Custom Card"}</h3>
      <TextInput
        label="Front"
        placeholder="Question / term"
        state={front}
        setState={setFront}
        multiline
      />
      <RichTextInput
        label="Back"
        placeholder="Answer / definition"
        value={back}
        onChange={setBack}
        multiline
        rows={3}
      />
      <div className={styles.deckActions} style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
        <Button callback={() => setOpen(false)} bgcolor="transparent" color="var(--fg-muted)">
          Cancel
        </Button>
        <Button callback={handleSave} disabled={saving}>
          {saving ? "Saving..." : card ? "Save changes" : "Add card"}
        </Button>
      </div>
    </Modal>
  );
};

/* ────────────────── Card Detail Modal ──────────────── */
const CardDetailModal = ({ open, setOpen, card, onToggleFavorite, onEdit, onDelete, allowEdit }) => {
  if (!card) return null;
  const status = getCardStatus(card);

  return (
    <Modal open={open} setOpen={setOpen}>
      <div className={styles.cardDetailHeader}>
        <Badge>{status}</Badge>
        {card.is_custom && <Badge>Custom</Badge>}
        {card.is_favorite && <Badge>★ Favorite</Badge>}
      </div>
      <div className={styles.cardPreview}>
        <div className={styles.cardSide}>
          <span className={styles.cardSideLabel}>Front</span>
          <p className={styles.cardSideText}>{card.front}</p>
        </div>
        <div className={styles.cardSide}>
          <span className={styles.cardSideLabel}>Back</span>
          <p className={styles.cardSideText}>{card.back}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.cardStats}>
        <span>Reviews: {card.review_count || 0}</span>
        <span>Streak: {card.correct_streak || 0}</span>
        {card.due && <span>Due: {new Date(card.due).toLocaleDateString()}</span>}
      </div>

      <div className={styles.deckActions} style={{ justifyContent: "flex-end", gap: "0.35rem", marginTop: "0.65rem" }}>
        <Button callback={() => onToggleFavorite(card)} bgcolor="transparent" color="var(--fg)">
          {card.is_favorite ? "★ Unfavorite" : "☆ Favorite"}
        </Button>
        {(allowEdit || card.is_custom) && (
          <Button callback={() => onEdit(card)} bgcolor="transparent" color="var(--fg)">
            Edit
          </Button>
        )}
        {card.is_custom && (
          <Button callback={() => onDelete(card)} bgcolor="transparent" color="var(--danger, #dc2626)">
            Delete
          </Button>
        )}
      </div>
    </Modal>
  );
};

/* ────────────────────── Main Page ──────────────────── */
const StudentDeckBrowse = () => {
  const { assignmentId } = useParams();
  const { data: cards, loading, refetch } = useStudentDeckCards(assignmentId);
  const { data: assignments } = useAssignments();
  const { createCard, loading: creating } = useCreateStudentCard();
  const { deleteCard } = useDeleteStudentCard();
  const { updateContent, loading: updating } = useUpdateStudentCardContent();
  const { toggle } = useToggleFavorite();

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [flipped, setFlipped] = useState(new Set());

  const assignment = useMemo(
    () => (assignments || []).find((a) => a.id === assignmentId),
    [assignments, assignmentId]
  );

  const deckName =
    assignment?.custom_name || assignment?.flashy_decks?.name || "Deck";

  const allowStudentCards = assignment?.allow_student_cards !== false;
  const allowStudentEdit = assignment?.allow_student_edit !== false;

  const filteredCards = useMemo(() => {
    let result = cards || [];
    const q = search.toLowerCase().trim();

    if (filter === "new") result = result.filter((c) => c.is_new);
    else if (filter === "mastered") result = result.filter((c) => c.mastered);
    else if (filter === "due")
      result = result.filter(
        (c) => !c.is_new && !c.mastered && new Date(c.due) < new Date()
      );
    else if (filter === "learning")
      result = result.filter((c) => !c.is_new && !c.mastered);
    else if (filter === "custom") result = result.filter((c) => c.is_custom);
    else if (filter === "favorite") result = result.filter((c) => c.is_favorite);

    if (q) {
      result = result.filter(
        (c) =>
          c.front?.toLowerCase().includes(q) ||
          c.back?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [cards, filter, search]);

  const counts = useMemo(() => {
    const all = cards || [];
    return {
      all: all.length,
      new: all.filter((c) => c.is_new).length,
      learning: all.filter((c) => !c.is_new && !c.mastered).length,
      mastered: all.filter((c) => c.mastered).length,
      due: all.filter(
        (c) => !c.is_new && !c.mastered && new Date(c.due) < new Date()
      ).length,
      custom: all.filter((c) => c.is_custom).length,
      favorite: all.filter((c) => c.is_favorite).length,
    };
  }, [cards]);

  const toggleFlip = (cardId) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  /* ─── handlers ─── */
  const handleToggleFav = async (card) => {
    await toggle(card.id, !card.is_favorite);
    refetch();
    setSelectedCard(null);
  };

  const handleAddCard = async ({ front, back }) => {
    try {
      await createCard(assignmentId, front, back);
      toast.success("Custom card added!");
      setShowAddCard(false);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to add card");
    }
  };

  const handleEditCard = async ({ front, back }) => {
    if (!editingCard) return;
    try {
      await updateContent(editingCard.id, { front, back });
      toast.success("Card updated!");
      setEditingCard(null);
      setSelectedCard(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update card");
    }
  };

  const handleDeleteCard = async (card) => {
    if (!window.confirm("Delete this custom card?")) return;
    try {
      await deleteCard(card.id);
      toast.success("Card deleted.");
      setSelectedCard(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete card");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div>
      <Link to="/" className={styles.backLink}>
        ← Back to Dashboard
      </Link>

      <div className={styles.browseHeader}>
        <div>
          <h1>{deckName}</h1>
          <p className={styles.subtitle}>
            {(cards || []).length} card{(cards || []).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className={styles.browseActions}>
          <Link to={`/study/${assignmentId}/new`}>
            <Button>Learn New ({counts.new})</Button>
          </Link>
          <Link to={`/study/${assignmentId}/due`}>
            <Button>Study Due ({counts.due})</Button>
          </Link>
          {allowStudentCards && (
            <Button callback={() => setShowAddCard(true)}>
              + Add Card
            </Button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className={styles.filterPills}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.filterPill} ${filter === f ? styles.filterPillActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "0.75rem" }}>
        <TextInput
          placeholder="Search cards..."
          state={search}
          setState={setSearch}
        />
      </div>

      {/* Cards grid TODO */}
      {filteredCards.length === 0 ? (
        <div className={styles.empty}>
          <h2>No cards match</h2>
          <p>Try a different filter or search term.</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {filteredCards.map((card) => {
            const status = getCardStatus(card);
            const isFlipped = flipped.has(card.id);
            return (
              <div
                key={card.id}
                className={styles.browseCard}
                onClick={() => toggleFlip(card.id)}
              >
                <div className={styles.browseCardHeader}>
                  <Badge style={{ fontSize: "0.65rem" }}>
                    {status}
                  </Badge>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {card.is_custom && (
                      <Badge style={{ fontSize: "0.65rem" }}>
                        custom
                      </Badge>
                    )}
                    {card.is_favorite && <span style={{ fontSize: "0.85rem" }}>★</span>}
                  </div>
                </div>

                <p className={styles.browseCardText}>
                  {isFlipped ? card.back : card.front}
                </p>
                <span className={styles.browseCardHint}>
                  {isFlipped ? "Back — tap to flip" : "Front — tap to flip"}
                </span>

                <button
                  className={styles.browseCardInfoBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCard(card);
                  }}
                >
                  ⓘ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CardDetailModal
        open={!!selectedCard}
        setOpen={(v) => !v && setSelectedCard(null)}
        card={selectedCard}
        onToggleFavorite={handleToggleFav}
        onEdit={(c) => {
          setSelectedCard(null);
          setEditingCard(c);
        }}
        onDelete={handleDeleteCard}
        allowEdit={allowStudentEdit}
      />

      <CardFormModal
        open={showAddCard}
        setOpen={setShowAddCard}
        card={null}
        onSave={handleAddCard}
        saving={creating}
      />

      <CardFormModal
        open={!!editingCard}
        setOpen={(v) => !v && setEditingCard(null)}
        card={editingCard}
        onSave={handleEditCard}
        saving={updating}
      />
    </div>
  );
};

export default StudentDeckBrowse;
