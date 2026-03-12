import { useNavigate, useParams } from "react-router";
import styles from "./Deck.module.css";
import { toast } from "react-toastify";
import Card from "../../common/components/Card";
import Button from "../../common/components/Button";
import Badge from "../../common/components/Badge";
import LoadingScreen from "../../common/components/LoadingScreen";
import EditCardModal from "./EditCardModal";
import AddCardTabs from "./AddCardTabs";
import { useState, useEffect, useCallback } from "react";
import RetentionBadge from "./RetentionBadge";
import { useDeck, useDeleteDeck, useDeleteCard, useUpdateDeck } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import { getSessionProgress } from "../../lib/studySession";
import dayjs from "dayjs";

const stripHtmlTags = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

const exportDeckCsv = (deckName, flashcards) => {
  const escape = (v) => {
    const s = stripHtmlTags(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = [
    "Term,Definition,Example",
    ...flashcards.map((c) =>
      `${escape(c.front)},${escape(c.back)},${escape(c.example_sentence)}`
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stripHtmlTags(deckName) || "deck"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const Deck = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editFlashcard, setEditFlashcard] = useState({
    front: "",
    back: "",
    id: "",
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const params = useParams();
  const { data: deck, loading, refetch } = useDeck(params.id);
  const { deleteDeck, loading: deleting } = useDeleteDeck();
  const { deleteCard } = useDeleteCard();
  const { updateDeck } = useUpdateDeck();
  const { t } = useSettings();

  const toggleCard = (cardId) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const selectAll = () => {
    if (deck) setSelectedCards(new Set(deck.flashcards.map((c) => c.id)));
  };

  const deselectAll = () => setSelectedCards(new Set());

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedCards(new Set());
      return !prev;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return;
    if (!window.confirm(`Delete ${selectedCards.size} card(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedCards) {
        await deleteCard(id);
      }
      toast.success(`Deleted ${selectedCards.size} card(s)`);
      setSelectedCards(new Set());
      setSelectionMode(false);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete some cards");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deck) return;
    if (!window.confirm(`Delete "${deck.name}" and all its cards? This cannot be undone.`)) return;
    try {
      await deleteDeck(params.id);
      toast.success("Deck deleted");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to delete deck");
    }
  };

  const handleArchiveDeck = async () => {
    if (!deck) return;
    try {
      await updateDeck(params.id, { is_archived: true });
      toast.success("Deck archived");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to archive deck");
    }
  };

  const handleShareDeck = async () => {
    if (!deck) return;
    try {
      let token = deck.share_token;
      if (!token) {
        // Generate a new share token
        token = crypto.randomUUID ? crypto.randomUUID() : (`${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await updateDeck(params.id, { share_token: token });
        refetch();
      }
      const shareUrl = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } catch (err) {
      toast.error(err.message || "Failed to generate share link");
    }
  };

  const handleUnshare = async () => {
    if (!deck) return;
    try {
      await updateDeck(params.id, { share_token: null });
      refetch();
      toast.success("Share link removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove share link");
    }
  };

  const handleRenameDeck = async () => {
    if (!deck) return;
    const current = String(deck.name || "").trim();
    const proposed = window.prompt("New deck name", current);
    if (proposed == null) return;
    const nextName = String(proposed).trim();
    if (!nextName || nextName === current) return;
    try {
      await updateDeck(params.id, { name: nextName });
      toast.success("Deck renamed");
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to rename deck");
    }
  };

  // ── Keyboard shortcuts for study actions ──
  const handleKeyboard = useCallback(
    (e) => {
      // Ignore when user is typing in an input/textarea/contenteditable
      const tag = e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      switch (e.key.toLowerCase()) {
        case "s":
          if (selectionMode) return;
          e.preventDefault();
          navigate("study");
          break;
        case "n":
          if (selectionMode) return;
          e.preventDefault();
          navigate("new");
          break;
        case "d":
          if (selectionMode) return;
          e.preventDefault();
          navigate("due");
          break;
        case "v":
          e.preventDefault();
          setViewMode((m) => (m === "grid" ? "table" : "grid"));
          break;
        case "escape":
          if (selectionMode) {
            e.preventDefault();
            toggleSelectionMode();
          }
          break;
        default:
          break;
      }
    },
    [navigate, selectionMode, toggleSelectionMode]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);
  useEffect(() => {
    if (deck?.name) {
      document.title = `${deck.name} | TutPro`;
      return () => { document.title = 'Flashcards | TutPro'; };
    }
  }, [deck?.name]);


  if (loading) return <LoadingScreen />;
  if (deck) {
    const deckCardsRetention = deck.flashcards.reduce((acc, curr) => {
      return acc + (curr.retention || 0);
    }, 0);
    const deckReviews = deck.flashcards.reduce((acc, curr) => {
      return acc + (curr.reviews || 0);
    }, 0);
    const deckRetention = deckReviews > 0
      ? Math.round((deckCardsRetention / deckReviews) * 100)
      : 0;
    const newCards = deck.flashcards.filter(
      (card) => card.is_new === true
    ).length;
    const dueCards = deck.flashcards.filter((card) => {
      return new Date(card.due) < new Date() && card.is_new === false;
    }).length;
    const hardCards = deck.flashcards.filter(
      (card) => (card.again_count || 0) >= 3 || (card.ease_factor && card.ease_factor < 2.0)
    ).length;
    const nextSortOrder = deck.flashcards.reduce(
      (highest, card, index) => Math.max(highest, card.sort_order ?? index),
      -1
    ) + 1;

    const sessionProgress = getSessionProgress(params.id);

    return (
      <>
        <EditCardModal
          flashcard={editFlashcard}
          open={isModalOpen}
          setOpen={setIsModalOpen}
          deckId={params.id}
          onSaved={refetch}
        />
        <div className={styles.menu}>
          <h1 className={styles.title}>
            {deck.name}
            {deckRetention > 0 ? (
              <RetentionBadge retention={deckRetention}>
                {" "}
                {t("retention")}
              </RetentionBadge>
            ) : null}
            <Badge>{deck.flashcards.length} {t("cards")}</Badge>
          </h1>
          <div className={styles.actions}>
            <button
              className={styles.addToggle}
              onClick={() => setShowAddPanel((p) => !p)}
              title={t("addCard")}
            >
              {showAddPanel ? "−" : "+"}
            </button>
            {sessionProgress !== null && sessionProgress < 100 && (
              <Button
                callback={() => navigate("study")}
                bgcolor="var(--fg)"
                color="var(--bg)"
              >
                ▶ {t("continueStudy")} {sessionProgress}%
              </Button>
            )}
            <Button
              callback={() => {
                navigate("study");
              }}
              title="S"
            >
              {t("study")}
            </Button>
            <Button
              callback={() => {
                navigate("new");
              }}
              title="N"
            >
              {t("learnNewBtn")} <Badge style={{ fontSize: "0.7em" }}>{newCards}</Badge>
            </Button>
            <Button
              callback={() => {
                navigate("due");
              }}
              title="D"
            >
              {t("studyDue")} <Badge style={{ fontSize: "0.7em" }}>{dueCards}</Badge>
            </Button>
            {hardCards > 0 && (
              <Button
                callback={() => {
                  navigate("study?pool=hard");
                }}
              >
                {t("hard")} <Badge style={{ fontSize: "0.7em" }}>{hardCards}</Badge>
              </Button>
            )}
            <button
              className={`${styles.viewToggle} ${selectionMode ? styles.viewToggleActive : ""}`}
              onClick={toggleSelectionMode}
              title={selectionMode ? "Exit selection" : "Select cards"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </button>
            <button
              className={styles.viewToggle}
              onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
              title={viewMode === "grid" ? t("switchToTable") + " (V)" : t("switchToGrid") + " (V)"}
            >
              {viewMode === "grid"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              }
            </button>
            <button
              className={styles.viewToggle}
              onClick={() => exportDeckCsv(deck.name, deck.flashcards)}
              title={t("exportDeck")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button
              className={styles.viewToggle}
              onClick={handleRenameDeck}
              title="Rename deck"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button
              className={`${styles.viewToggle} ${deck.share_token ? styles.viewToggleActive : ""}`}
              onClick={deck.share_token ? handleUnshare : handleShareDeck}
              title={deck.share_token ? "Remove share link" : "Copy share link"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <button
              className={styles.viewToggle}
              onClick={handleArchiveDeck}
              title="Archive deck"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </button>
            <button
              className={styles.viewToggle}
              onClick={handleDeleteDeck}
              disabled={deleting}
              title="Delete deck"
              style={{ color: "var(--danger, #dc2626)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <AddCardTabs deckId={params.id} onChanged={refetch} startSortOrder={nextSortOrder} show={showAddPanel} />
        {selectionMode && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedCards.size} selected</span>
            <button className={styles.bulkBtn} onClick={selectedCards.size === deck.flashcards.length ? deselectAll : selectAll}>
              {selectedCards.size === deck.flashcards.length ? t("deselectAll") || "Deselect all" : t("selectAll") || "Select all"}
            </button>
            {selectedCards.size > 0 && (
              <button className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`} onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? "Deleting…" : `Delete ${selectedCards.size}`}
              </button>
            )}
            <button className={styles.bulkBtn} onClick={toggleSelectionMode}>✕</button>
          </div>
        )}
        {viewMode === "grid" ? (
          <div className={styles.flashcardContainer}>
            {deck.flashcards.map((flashcard) => (
              <div
                key={flashcard.id}
                className={`${styles.cardWrapper} ${selectionMode && selectedCards.has(flashcard.id) ? styles.cardSelected : ""}`}
                onClick={() => {
                  if (selectionMode) {
                    toggleCard(flashcard.id);
                  } else {
                    setEditFlashcard(flashcard);
                    setIsModalOpen(true);
                  }
                }}
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    className={styles.cardCheckbox}
                    checked={selectedCards.has(flashcard.id)}
                    onChange={() => toggleCard(flashcard.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <Card flashcard={flashcard} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.tableView}>
            <div className={styles.tableHeader}>
              {selectionMode && <span className={styles.tableCheckCol} />}
              <span className={styles.tableRowTerm}>{t("term")}</span>
              <span className={styles.tableRowDef}>{t("definition")}</span>
              <span className={styles.tableRowDue}>{t("dueColumn")}</span>
            </div>
            {deck.flashcards.map((flashcard) => {
              const due = flashcard.due ? dayjs(flashcard.due) : null;
              const isOverdue = due && due.isBefore(dayjs());
              return (
                <div
                  key={flashcard.id}
                  className={`${styles.tableRow} ${selectionMode && selectedCards.has(flashcard.id) ? styles.tableRowSelected : ""}`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleCard(flashcard.id);
                    } else {
                      setEditFlashcard(flashcard);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  {selectionMode && (
                    <input
                      type="checkbox"
                      className={styles.tableCheckbox}
                      checked={selectedCards.has(flashcard.id)}
                      onChange={() => toggleCard(flashcard.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <span className={styles.tableRowTerm}>{flashcard.front}</span>
                  <span className={styles.tableRowDef}>{flashcard.back}</span>
                  <span className={`${styles.tableRowDue} ${isOverdue ? styles.overdue : ""}`}>
                    {flashcard.is_new ? t("newBadge") : due ? due.fromNow() : t("neverStudied")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  } else {
    toast.error(t("deckNotFound"));
    return <h1>{t("error")}</h1>;
  }
};

export default Deck;
