import { Link } from "react-router-dom";
import styles from "./DeckLink.module.css";
import DeleteDeckModal from "./DeleteDeckModal";
import { useState } from "react";
import { useDeleteDeck } from "../../hooks/useSupabaseData";
import { toast } from "react-toastify";

const DeckLink = ({ id, name, onDeleted }) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { deleteDeck } = useDeleteDeck();

  const handleDelete = async () => {
    try {
      await deleteDeck(id);
      if (onDeleted) onDeleted();
    } catch (err) {
      toast.error(err.message || "Failed to delete deck");
    }
  };

  return (
    <>
      <div className={styles.deckLink}>
        <Link className={styles.link} key={id} to={`/deck/${id}`}>
          {name}
        </Link>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={styles.deleteIcon}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          onClick={() => setDeleteModalOpen(true)}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </div>
      <DeleteDeckModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        callback={handleDelete}
      />
    </>
  );
};

export default DeckLink;
