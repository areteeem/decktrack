import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DeckCard from "../../common/components/DeckCard";
import LoadingScreen from "../../common/components/LoadingScreen";
import Button from "../../common/components/Button";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Dashboard.module.css";
import { useDecks } from "../../hooks/useSupabaseData";
import NewDeckModal from "../../modules/Sidebar/NewDeckModal";

const Dashboard = () => {
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const navigate = useNavigate();
  const { isTeacher } = useAuth();
  const { data: decks, loading, error, refetch } = useDecks();

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
    </>
  );
};

export default Dashboard;
