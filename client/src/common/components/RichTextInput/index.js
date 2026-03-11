import { useRef, useEffect, useCallback, useState } from "react";
import styles from "./RichTextInput.module.css";

/**
 * Rich text input with formatting toolbar.
 * Supports Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline).
 * Shows a floating toolbar on text selection (like telegram.ph).
 *
 * Props:
 *   - label: string
 *   - helperText: string
 *   - value: string (HTML)
 *   - onChange: (html: string) => void
 *   - placeholder: string
 *   - multiline: boolean (just affects min-height)
 *   - rows: number
 */
const RichTextInput = ({ label, helperText, value, onChange, placeholder, multiline, rows = 3 }) => {
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const isInternalChange = useRef(false);

  // Sync external value into contentEditable
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    onChange?.(editorRef.current.innerHTML);
  }, [onChange]);

  const execCommand = useCallback((cmd, value) => {
    document.execCommand(cmd, false, value || null);
    editorRef.current?.focus();
    emitChange();
  }, [emitChange]);

  const insertLink = useCallback(() => {
    const sel = window.getSelection();
    const selectedText = sel?.toString() || "";
    const url = prompt("URL:", selectedText.startsWith("http") ? selectedText : "https://");
    if (url) {
      execCommand("createLink", url);
    }
  }, [execCommand]);

  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); execCommand("bold"); }
      else if (e.key === "i") { e.preventDefault(); execCommand("italic"); }
      else if (e.key === "u") { e.preventDefault(); execCommand("underline"); }
      else if (e.key === "k") { e.preventDefault(); insertLink(); }
    }
  }, [execCommand, insertLink]);

  const handleInput = useCallback(() => {
    emitChange();
  }, [emitChange]);

  const updateToolbarPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setShowToolbar(false);
      return;
    }

    // Make sure selection is inside our editor
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      setShowToolbar(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    setToolbarPos({
      top: rect.top - editorRect.top - 36,
      left: rect.left - editorRect.left + rect.width / 2 - 50,
    });
    setShowToolbar(true);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbarPosition);
    return () => document.removeEventListener("selectionchange", updateToolbarPosition);
  }, [updateToolbarPosition]);

  const handleBlur = useCallback((e) => {
    // Delay hiding so toolbar buttons can be clicked
    setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement) &&
          !editorRef.current?.contains(document.activeElement)) {
        setShowToolbar(false);
      }
    }, 150);
  }, []);

  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.editorWrapper}>
        <div
          ref={editorRef}
          className={`${styles.editor} ${multiline ? styles.multiline : ""}`}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onBlur={handleBlur}
          data-placeholder={placeholder}
        />
        {showToolbar && (
          <div
            ref={toolbarRef}
            className={styles.toolbar}
            style={{ top: toolbarPos.top, left: toolbarPos.left }}
            onMouseDown={(e) => e.preventDefault()} // prevent stealing focus
          >
            <button type="button" className={styles.toolbarBtn} onClick={() => execCommand("bold")} title="Bold (Ctrl+B)">
              <strong>B</strong>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => execCommand("italic")} title="Italic (Ctrl+I)">
              <em>i</em>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={insertLink} title="Link (Ctrl+K)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => execCommand("strikeThrough")} title="Strikethrough">
              <s>T</s>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => execCommand("underline")} title="Underline (Ctrl+U)">
              <u>U</u>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => execCommand("formatBlock", "<blockquote>")} title="Quote">
              <span style={{ fontWeight: 700 }}>&ldquo;</span>
            </button>
          </div>
        )}
      </div>
      {helperText && <span className={styles.helper}>{helperText}</span>}
    </label>
  );
};

export default RichTextInput;
