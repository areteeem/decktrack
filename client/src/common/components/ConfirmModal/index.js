import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import styles from "./ConfirmModal.module.css";

/**
 * Drop-in replacement for window.confirm.
 * Supports optional typed-confirmation for dangerous bulk operations
 * and a details list to show cascading impact.
 *
 * Props:
 *   open, message, title, confirmLabel, cancelLabel, danger, onConfirm, onCancel
 *   details     — string[] list of extra details (e.g. cascade info)
 *   requireType — string the user must type to enable confirm (e.g. "DELETE")
 */
const ConfirmModal = ({
  open,
  message,
  title = "Confirm",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  details,
  requireType,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef(null);
  const [typed, setTyped] = useState("");

  // Reset typed value when modal opens/closes
  useEffect(() => {
    if (open) { setTyped(""); }
  }, [open]);

  useEffect(() => {
    if (open && !requireType) confirmRef.current?.focus();
  }, [open, requireType]);

  const canConfirm = !requireType || typed === requireType;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Enter" && canConfirm) { e.preventDefault(); onConfirm?.(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onConfirm, canConfirm]);

  return (
    <Modal open={open} setOpen={() => onCancel?.()} showCloseButton={false}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {details && details.length > 0 && (
        <ul className={styles.detailsList}>
          {details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {requireType && (
        <div className={styles.typeConfirm}>
          <label className={styles.typeLabel}>
            Type <strong>{requireType}</strong> to confirm
          </label>
          <input
            className={styles.typeInput}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      )}
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
        <button
          ref={confirmRef}
          className={danger ? styles.dangerBtn : styles.confirmBtn}
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
