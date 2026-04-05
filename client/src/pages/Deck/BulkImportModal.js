import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Button from "../../common/components/Button";
import Modal from "../../common/components/Modal";
import TextInput from "../../common/components/TextInput";
import { useCreateCardsBulk } from "../../hooks/useSupabaseData";
import { parseCardsFromFile, parseCardsFromPaste } from "./bulkImport";
import styles from "./BulkImportModal.module.css";

const MODES = {
  upload: "upload",
  paste: "paste",
};

const DELIMITER_OPTIONS = [
  { value: "auto", label: "Auto detect" },
  { value: "tab", label: "Tab" },
  { value: "comma", label: "Comma" },
  { value: "semicolon", label: "Semicolon" },
  { value: "pipe", label: "Pipe |" },
  { value: "dash", label: "Dash -" },
  { value: "colon", label: "Colon :" },
  { value: "pairs", label: "Every two lines" },
];

const EXAMPLE_TEXT = `term\tdefinition\nresilient\table to recover quickly after difficulty\ncurious\teager to learn or know something`;

const BulkImportModal = ({ open, setOpen, deckId, startSortOrder = 0, onImported }) => {
  const { createCardsBulk, loading } = useCreateCardsBulk();
  const [mode, setMode] = useState(MODES.upload);
  const [pasteText, setPasteText] = useState("");
  const [delimiter, setDelimiter] = useState("auto");
  const [previewCards, setPreviewCards] = useState([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [parsing, setParsing] = useState(false);

  const previewCount = previewCards.length;

  const previewSample = useMemo(() => previewCards.slice(0, 8), [previewCards]);

  const resetState = () => {
    setPasteText("");
    setDelimiter("auto");
    setPreviewCards([]);
    setSourceLabel("");
    setParsing(false);
  };

  const handleClose = () => {
    resetState();
    setOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setParsing(true);
    try {
      const cards = await parseCardsFromFile(file);
      setPreviewCards(cards);
      setSourceLabel(file.name);
      toast.success(`${cards.length} cards ready to import.`);
    } catch (err) {
      toast.error(err.message || "Could not read the selected file.");
    }
    setParsing(false);
  };

  const handlePreparePaste = () => {
    try {
      const cards = parseCardsFromPaste(pasteText, delimiter);
      setPreviewCards(cards);
      setSourceLabel("Pasted text");
      toast.success(`${cards.length} cards ready to import.`);
    } catch (err) {
      toast.error(err.message || "Could not parse the pasted text.");
    }
  };

  const handleImport = async () => {
    if (!previewCards.length) {
      toast.error("Prepare a preview before importing.");
      return;
    }

    try {
      const payload = previewCards.map((card, index) => ({
        ...card,
        deck_id: deckId,
        sort_order: startSortOrder + index,
      }));
      await createCardsBulk(payload);
      toast.success(`${previewCards.length} cards imported.`);
      handleClose();
      onImported?.();
    } catch (err) {
      toast.error(err.message || "Failed to import cards.");
    }
  };

  return (
    <Modal open={open} setOpen={handleClose} contentClassName={styles.modal}>
      <div className={styles.header}>
        <h2>Bulk import cards</h2>
        <p>
          Upload XLSX or CSV files, or paste rows separated by tabs, commas, or another delimiter. The first column becomes the term and the second becomes the definition.
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          <button
            type="button"
            className={mode === MODES.upload ? styles.activeMode : ""}
            onClick={() => setMode(MODES.upload)}
          >
            Upload file
          </button>
          <button
            type="button"
            className={mode === MODES.paste ? styles.activeMode : ""}
            onClick={() => setMode(MODES.paste)}
          >
            Paste text
          </button>
        </div>
        {sourceLabel && <span className={styles.sourceNote}>Source: {sourceLabel}</span>}
      </div>

      <div className={styles.form}>
        {mode === MODES.upload ? (
          <div className={styles.uploadBox}>
            <input type="file" accept=".csv,.xlsx,.json,.txt" onChange={handleFileChange} />
            <p className={styles.hint}>
              Supported formats: XLSX, CSV, JSON, and TXT. Header names like <strong>Term</strong> and <strong>Definition</strong> are detected automatically. Save legacy XLS files as XLSX or CSV first.
            </p>
          </div>
        ) : (
          <>
            <label className={styles.hint} htmlFor="bulk-import-delimiter">Separator</label>
            <select
              id="bulk-import-delimiter"
              className={styles.select}
              value={delimiter}
              onChange={(event) => setDelimiter(event.target.value)}
            >
              {DELIMITER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <TextInput
              label="Paste cards"
              helperText="Example: copy two spreadsheet columns and paste them directly."
              multiline
              rows={10}
              state={pasteText}
              setState={setPasteText}
              placeholder={EXAMPLE_TEXT}
            />
            <div>
              <Button callback={handlePreparePaste} disabled={!pasteText.trim() || parsing}>
                Prepare preview
              </Button>
            </div>
          </>
        )}

        <div className={styles.previewHeader}>
          <div>
            <strong>Preview</strong>
            <p className={styles.hint}>
              {previewCount > 0
                ? `${previewCount} card${previewCount === 1 ? "" : "s"} ready to import.`
                : "Prepare a file or pasted text to preview the cards."}
            </p>
          </div>
          {parsing && <span className={styles.sourceNote}>Reading file...</span>}
        </div>

        {previewCount > 0 && (
          <div className={styles.previewWrapper}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Definition</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {previewSample.map((card, index) => (
                  <tr key={`${card.front}-${index}`}>
                    <td>{card.front}</td>
                    <td>{card.back}</td>
                    <td>{card.example_sentence || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.actions}>
          <Button callback={handleClose} bgcolor="transparent" color="var(--fg-muted)">
            Cancel
          </Button>
          <div className={styles.primaryActions}>
            <Button callback={handleImport} disabled={!previewCount || loading || parsing}>
              {loading ? "Importing..." : `Import ${previewCount || ""} cards`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BulkImportModal;
