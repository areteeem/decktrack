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
import { useDeck } from "../../hooks/useSupabaseData";
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
  const navigate = useNavigate();
  const params = useParams();
  const { data: deck, loading, refetch } = useDeck(params.id);
  const { t } = useSettings();

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
          e.preventDefault();
          navigate("study");
          break;
        case "n":
          e.preventDefault();
          navigate("new");
          break;
        case "d":
          e.preventDefault();
          navigate("due");
          break;
        case "v":
          e.preventDefault();
          setViewMode((m) => (m === "grid" ? "table" : "grid"));
          break;
        default:
          break;
      }
    },
    [navigate]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboard);
    return () => document.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);

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
              className={styles.viewToggle}
              onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
              title={viewMode === "grid" ? t("switchToTable") + " (V)" : t("switchToGrid") + " (V)"}
            >
              {viewMode === "grid" ? "☰" : "▦"}
            </button>
            <button
              className={styles.viewToggle}
              onClick={() => exportDeckCsv(deck.name, deck.flashcards)}
              title={t("exportDeck")}
            >
              ⤓
            </button>
          </div>
        </div>
        <AddCardTabs deckId={params.id} onChanged={refetch} startSortOrder={nextSortOrder} show={showAddPanel} />
        {viewMode === "grid" ? (
          <div className={styles.flashcardContainer}>
            {deck.flashcards.map((flashcard) => (
              <Card
                key={flashcard.id}
                flashcard={flashcard}
                onClick={() => {
                  setEditFlashcard(flashcard);
                  setIsModalOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.tableView}>
            <div className={styles.tableHeader}>
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
                  className={styles.tableRow}
                  onClick={() => {
                    setEditFlashcard(flashcard);
                    setIsModalOpen(true);
                  }}
                >
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
