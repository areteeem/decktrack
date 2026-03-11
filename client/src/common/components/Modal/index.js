import { useEffect } from "react";
import styles from "./Modal.module.css";

const Modal = ({ children, open, setOpen, contentClassName, showCloseButton = true }) => {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.root} role="dialog" aria-modal="true">
      <div className={styles.overlay} onClick={() => setOpen(false)} />
      <div className={`${styles.modal}${contentClassName ? ` ${contentClassName}` : ""}`}>
        {showCloseButton && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close modal"
          >
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
