import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeckCard from "../../common/components/DeckCard";
import LoadingScreen from "../../common/components/LoadingScreen";
import Button from "../../common/components/Button";
import Badge from "../../common/components/Badge";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Dashboard.module.css";
import { useDecks, useArchivedDecks, useDeleteDeck, useUpdateDeck } from "../../hooks/useSupabaseData";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";
import { toast } from "react-toastify";

const Dashboard = () => {
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const { isTeacher } = useAuth();
  const { data: decks, loading, error, refetch } = useDecks();
  const { data: archivedDecks, refetch: refetchArchived } = useArchivedDecks();
  const { deleteDeck } = useDeleteDeck();
  const { updateDeck } = useUpdateDeck();

  if (error) return <p>Error :(</p>;
  if (loading) return <LoadingScreen />;

  return (
    <>
      <NewDeckModal
        open={showNewDeckModal}
        setOpen={setShowNewDeckModal}
        onCreated={refetch}
      />

      <div className={styles.header}>
        <div>
          <h1>Your decks</h1>
          {isTeacher && (
            <p className={styles.subtitle}>
              Create decks, add cards, and assign them to your students.
            </p>
          )}
        </div>

        {isTeacher && (
          <div className={styles.actions}>
            <Button callback={() => setShowNewDeckModal(true)}>+ New deck</Button>
            <Button callback={() => navigate("/students")}>My students</Button>
          </div>
        )}
      </div>

      {isTeacher && (!decks || decks.length === 0) ? (
        <div className={styles.emptyState}>
          <h2>No decks yet</h2>
          <p>Start by creating your first deck, then open it to add flashcards.</p>
          <div className={styles.actions}>
            <Button callback={() => setShowNewDeckModal(true)}>Create first deck</Button>
            <Button callback={() => navigate("/students")}>Open students</Button>
          </div>
        </div>
      ) : null}

      <div className={styles.deckContainer}>
        {(decks || []).map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>

      {/* Archived decks */}
      {archivedDecks?.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
              padding: "0.35rem 0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: showArchived ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Archived decks ({archivedDecks.length})
          </button>
          {showArchived && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              {archivedDecks.map((deck) => (
                <div
                  key={deck.id}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                    opacity: 0.7,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{deck.name}</h3>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "var(--fg-muted)" }}>
                    {deck.cardCount} cards
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <Button
                      callback={async () => {
                        try {
                          await updateDeck(deck.id, { is_archived: false });
                          toast.success("Deck restored");
                          refetch();
                          refetchArchived();
                        } catch (e) {
                          toast.error(e.message || "Failed to restore");
                        }
                      }}
                      bgcolor="transparent"
                      color="var(--fg)"
                    >
                      Restore
                    </Button>
                    <Button
                      callback={async () => {
                        if (!window.confirm(`Permanently delete "${deck.name}" and all its cards? This cannot be undone.`)) return;
                        try {
                          await deleteDeck(deck.id);
                          toast.success("Deck deleted permanently");
                          refetchArchived();
                        } catch (e) {
                          toast.error(e.message || "Failed to delete");
                        }
                      }}
                      bgcolor="transparent"
                      color="var(--danger, #c00)"
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Dashboard;
