import { useState, useRef } from "react";
import styles from "./Settings.module.css";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useDecks, useCreateDeck, useCreateCardsBulk } from "../../hooks/useSupabaseData";
import Modal from "../../common/components/Modal";
import Button from "../../common/components/Button";
import { toast } from "react-toastify";

const stripHtmlTags = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

const Settings = () => {
  const { profile, role } = useAuth();
  const { theme, toggle } = useTheme();
  const { srsMode, setSrsMode, locale, setLocale, t } = useSettings();
  const { data: decks, refetch } = useDecks();
  const { createDeck } = useCreateDeck();
  const { createCardsBulk } = useCreateCardsBulk();
  const importFileRef = useRef(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    if (!decks?.length) { toast.info("No decks to export"); return; }
    const data = decks.map((deck) => ({
      name: stripHtmlTags(deck.name),
      cards: (deck.flashcards || []).map((c) => ({
        front: stripHtmlTags(c.front),
        back: stripHtmlTags(c.back),
        example_sentence: stripHtmlTags(c.example_sentence),
        ...(c.card_type && c.card_type !== "normal" ? { card_type: c.card_type } : {}),
      })),
    }));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-decks.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} deck${data.length === 1 ? "" : "s"}`);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error("Expected an array of decks");
        for (const d of parsed) {
          if (!d.name || typeof d.name !== "string") throw new Error("Each deck must have a name");
          if (!Array.isArray(d.cards)) throw new Error(`Deck "${d.name}" is missing a cards array`);
        }
        setPendingImport(parsed);
      } catch (err) {
        toast.error(`Invalid file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingImport?.length) return;
    setImporting(true);
    let created = 0;
    try {
      for (const deckData of pendingImport) {
        const deck = await createDeck({ name: deckData.name });
        if (deckData.cards.length > 0) {
          await createCardsBulk(
            deckData.cards.map((c) => ({
              deck_id: deck.id,
              front: c.front || "",
              back: c.back || "",
              example_sentence: c.example_sentence || "",
              card_type: c.card_type || "normal",
            }))
          );
        }
        created++;
      }
      toast.success(`Imported ${created} deck${created === 1 ? "" : "s"}`);
      refetch();
    } catch (err) {
      toast.error(`Import failed after ${created} decks: ${err.message}`);
    } finally {
      setImporting(false);
      setPendingImport(null);
    }
  };

  return (
    <div className={styles.settings}>
      <h1>{t("settingsTitle")}</h1>

      {/* ── Profile ────────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t("profile")}</span>
        <div className={styles.profileCard}>
          {profile?.display_name && (
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>{t("name")}</span>
              <span className={styles.profileValue}>{profile.display_name}</span>
            </div>
          )}
          {profile?.email && (
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>{t("email")}</span>
              <span className={styles.profileValue}>{profile.email}</span>
            </div>
          )}
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>{t("role")}</span>
            <span className={styles.profileValue}>{role || "—"}</span>
          </div>
        </div>
      </div>

      <hr className={styles.separator} />

      {/* ── Appearance ─────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t("appearance")}</span>
        <div className={styles.optionGroup}>
          <button
            className={theme === "light" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => { if (theme !== "light") toggle(); }}
          >
            {t("light")}
          </button>
          <button
            className={theme === "dark" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => { if (theme !== "dark") toggle(); }}
          >
            {t("dark")}
          </button>
        </div>
      </div>

      <hr className={styles.separator} />

      {/* ── Language ───────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t("language")}</span>
        <div className={styles.optionGroup}>
          <button
            className={locale === "en" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => setLocale("en")}
          >
            English
          </button>
          <button
            className={locale === "uk" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => setLocale("uk")}
          >
            Українська
          </button>
        </div>
      </div>

      <hr className={styles.separator} />

      {/* ── Study mode ─────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t("gradingMode")}</span>
        <div className={styles.optionGroup}>
          <button
            className={srsMode === "simple" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => setSrsMode("simple")}
          >
            {t("againKnow")}
          </button>
          <button
            className={srsMode === "full" ? styles.optionBtnActive : styles.optionBtn}
            onClick={() => setSrsMode("full")}
          >
            {t("fullGrading")}
          </button>
        </div>
        <p className={styles.desc}>
          {srsMode === "simple" ? t("gradingSimpleDesc") : t("gradingFullDesc")}
        </p>
      </div>

      <hr className={styles.separator} />

      {/* ── Data ───────────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Data</span>
        <p className={styles.desc} style={{ marginTop: 0, marginBottom: "0.6rem" }}>
          Export all your decks as JSON, or import decks from a previously exported file.
        </p>
        <div className={styles.dataActions}>
          <button className={styles.dataBtn} onClick={handleExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export all decks
          </button>
          <button className={styles.dataBtn} onClick={() => importFileRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import decks
          </button>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Import confirmation modal */}
      <Modal open={Boolean(pendingImport)} setOpen={() => setPendingImport(null)}>
        <h3 style={{ marginTop: 0 }}>Import {pendingImport?.length} deck{pendingImport?.length === 1 ? "" : "s"}?</h3>
        <div className={styles.importList}>
          {(pendingImport || []).map((d, i) => (
            <div key={i} className={styles.importRow}>
              <span className={styles.importName}>{d.name}</span>
              <span className={styles.importCount}>{d.cards.length} card{d.cards.length === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <Button callback={() => setPendingImport(null)} bgcolor="transparent" color="var(--fg-muted)">Cancel</Button>
          <Button callback={handleConfirmImport} disabled={importing}>
            {importing ? "Importing..." : `Import ${pendingImport?.length || 0} deck${pendingImport?.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
