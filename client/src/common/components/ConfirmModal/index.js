import { useEffect, useRef } from "react";
import Modal from "../Modal";
import Button from "../Button";
import styles from "./ConfirmModal.module.css";

/**
 * Drop-in replacement for window.confirm.
 * Usage:
 *   <ConfirmModal
 *     open={showConfirm}
 *     message="Delete this item?"
 *     onConfirm={() => { doDelete(); setShowConfirm(false); }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
const ConfirmModal = ({
  open,
  message,
  title = "Confirm",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Enter") { e.preventDefault(); onConfirm?.(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onConfirm]);

  return (
    <Modal open={open} setOpen={() => onCancel?.()} showCloseButton={false}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
        <button
          ref={confirmRef}
          className={danger ? styles.dangerBtn : styles.confirmBtn}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
