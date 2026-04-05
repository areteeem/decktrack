import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Button from "../../common/components/Button";
import TextInput from "../../common/components/TextInput";
import { useCreateCardsBulk } from "../../hooks/useSupabaseData";
import { useSettings } from "../../contexts/SettingsContext";
import { parseCardsFromFile, parseCardsFromPaste } from "./bulkImport";
import styles from "./InlineBulkImport.module.css";

const DELIMITER_OPTIONS = [
  { value: "auto", tKey: "autoDetect" },
  { value: "tab", tKey: "tab" },
  { value: "comma", tKey: "comma" },
  { value: "semicolon", tKey: "semicolon" },
  { value: "pipe", tKey: "pipe" },
  { value: "dash", tKey: "dash" },
  { value: "colon", tKey: "colon" },
  { value: "pairs", tKey: "everyTwoLines" },
];

const InlineBulkImport = ({ deckId, startSortOrder = 0, onImported }) => {
  const { createCardsBulk, loading } = useCreateCardsBulk();
  const { t } = useSettings();

  const [subTab, setSubTab] = useState("upload");
  const [pasteText, setPasteText] = useState("");
  const [delimiter, setDelimiter] = useState("auto");
  const [previewCards, setPreviewCards] = useState([]);
  const [parsing, setParsing] = useState(false);

  const previewSample = useMemo(() => previewCards.slice(0, 8), [previewCards]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setParsing(true);
    try {
      const cards = await parseCardsFromFile(file);
      setPreviewCards(cards);
      toast.success(`${cards.length} ${t("nCardsReady")}`);
    } catch (err) {
      toast.error(err.message || t("couldntRead"));
    }
    setParsing(false);
  };

  const handlePreparePaste = () => {
    try {
      const cards = parseCardsFromPaste(pasteText, delimiter);
      setPreviewCards(cards);
      toast.success(`${cards.length} ${t("nCardsReady")}`);
    } catch (err) {
      toast.error(err.message || t("couldntParse"));
    }
  };

  const handleImport = async () => {
    if (!previewCards.length) {
      toast.error(t("prepareBeforeImport"));
      return;
    }
    try {
      const payload = previewCards.map((card, index) => ({
        ...card,
        deck_id: deckId,
        sort_order: startSortOrder + index,
        ...(card.card_type ? { card_type: card.card_type } : {}),
      }));
      await createCardsBulk(payload);
      toast.success(`${previewCards.length} ${t("nCardsImported")}`);
      setPreviewCards([]);
      setPasteText("");
      onImported?.();
    } catch (err) {
      toast.error(err.message || t("failedImport"));
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.subTabs}>
        <button
          className={subTab === "upload" ? styles.subTabActive : styles.subTab}
          onClick={() => setSubTab("upload")}
        >
          {t("uploadFile")}
        </button>
        <button
          className={subTab === "paste" ? styles.subTabActive : styles.subTab}
          onClick={() => setSubTab("paste")}
        >
          {t("pasteText")}
        </button>
      </div>

      {subTab === "upload" ? (
        <div className={styles.uploadBox}>
          <input type="file" accept=".csv,.xlsx,.txt,.json" onChange={handleFileChange} />
          <p className={styles.hint}>{t("supportedFormats")}</p>
        </div>
      ) : (
        <div className={styles.pasteSection}>
          <label className={styles.hint} htmlFor="inline-delimiter">{t("separator")}</label>
          <select
            id="inline-delimiter"
            className={styles.select}
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
          >
            {DELIMITER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.tKey)}</option>
            ))}
          </select>
          <TextInput
            label={t("pasteCards")}
            helperText={t("pasteHelper")}
            multiline
            rows={6}
            state={pasteText}
            setState={setPasteText}
          />
          <Button callback={handlePreparePaste} disabled={!pasteText.trim() || parsing}>
            {t("preparePreview")}
          </Button>
        </div>
      )}

      {previewCards.length > 0 && (
        <div className={styles.previewSection}>
          <strong>{t("preview")}</strong>
          <span className={styles.hint}> — {previewCards.length} {t("readyToImport")}</span>
          <table className={styles.previewTable}>
            <thead>
              <tr>
                <th>{t("term")}</th>
                <th>{t("definition")}</th>
                <th>{t("example")}</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {previewSample.map((card, i) => (
                <tr key={`${card.front}-${i}`}>
                  <td>{card.front}</td>
                  <td>{card.back}</td>
                  <td>{card.example_sentence || "—"}</td>
                  <td>{card.card_type === 'fill_blank' ? 'Fill-blank' : 'Normal'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.actions}>
            <Button callback={handleImport} disabled={loading || parsing}>
              {loading ? t("importing") : `${t("importN")} ${previewCards.length}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineBulkImport;
