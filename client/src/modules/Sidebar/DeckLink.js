import { Link, useNavigate } from "react-router-dom";
import styles from "./DeckLink.module.css";
import DeleteDeckModal from "./DeleteDeckModal";
import ContextMenu from "../../common/components/ContextMenu";
import { useState } from "react";
import { useDeleteDeck } from "../../hooks/useSupabaseData";
import { toast } from "react-toastify";

const DeckLink = ({ id, name, cardCount, onDeleted, pinned, onTogglePin }) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const { deleteDeck } = useDeleteDeck();
  const navigate = useNavigate();

  const handleDelete = async () => {
    try {
      await deleteDeck(id);
      if (onDeleted) onDeleted();
    } catch (err) {
      toast.error(err.message || "Failed to delete deck");
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Open deck", onClick: () => navigate(`/deck/${id}`) },
        { label: "Study deck", onClick: () => navigate(`/deck/${id}/study`) },
        { separator: true },
        { label: pinned ? "Unpin deck" : "Pin deck", onClick: () => onTogglePin && onTogglePin() },
        { separator: true },
        { label: "Delete deck", danger: true, onClick: () => setDeleteModalOpen(true) },
      ],
    });
  };

  return (
    <>
      <div className={styles.deckLink} onContextMenu={handleContextMenu}>
        <Link className={styles.link} key={id} to={`/deck/${id}`}>
          {pinned && <span className={styles.pinIcon} title="Pinned">&bull;</span>}
          {name}
          {cardCount != null && <span className={styles.cardCount}>{cardCount}</span>}
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
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
};

export default DeckLink;
