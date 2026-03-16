import { useEffect, useRef, useCallback } from "react";
import styles from "./ContextMenu.module.css";

/**
 * Reusable context menu.
 *
 * Props:
 *  - x, y: position (number)
 *  - items: Array<{ label, onClick, danger?, shortcut?, separator? }>
 *  - onClose: () => void
 */
const ContextMenu = ({ x, y, items, onClose }) => {
  const menuRef = useRef(null);

  // Adjust position so the menu doesn't overflow the viewport
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${Math.max(4, window.innerWidth - rect.width - 8)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${Math.max(4, window.innerHeight - rect.height - 8)}px`;
    }
  }, [x, y]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleItemClick = useCallback(
    (item) => {
      if (item.separator) return;
      onClose();
      item.onClick?.();
    },
    [onClose]
  );

  return (
    <>
      <div className={styles.overlay} onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: x, top: y }}
        role="menu"
      >
        {items.map((item, i) =>
          item.separator ? (
            <div key={`sep-${i}`} className={styles.separator} />
          ) : (
            <button
              key={item.label || i}
              className={`${styles.item}${item.danger ? ` ${styles.danger}` : ""}`}
              role="menuitem"
              onClick={() => handleItemClick(item)}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
            </button>
          )
        )}
      </div>
    </>
  );
};

export default ContextMenu;
