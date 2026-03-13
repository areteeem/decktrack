import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import styles from "./PromptModal.module.css";

/**
 * Drop-in replacement for window.prompt.
 * Usage:
 *   <PromptModal
 *     open={showPrompt}
 *     message="Enter a new name"
 *     defaultValue={currentName}
 *     onSubmit={(value) => { rename(value); setShowPrompt(false); }}
 *     onCancel={() => setShowPrompt(false)}
 *   />
 */
const PromptModal = ({
  open,
  message,
  title = "Input",
  defaultValue = "",
  placeholder = "",
  submitLabel = "OK",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(value);
  };

  return (
    <Modal open={open} setOpen={() => onCancel?.()} showCloseButton={false}>
      <h3 className={styles.title}>{title}</h3>
      {message && <p className={styles.message}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>{cancelLabel}</button>
          <button type="submit" className={styles.submitBtn}>{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
};

export default PromptModal;
