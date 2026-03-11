import styles from "./Settings.module.css";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";

const Settings = () => {
  const { profile, role } = useAuth();
  const { theme, toggle } = useTheme();
  const { srsMode, setSrsMode, locale, setLocale, t } = useSettings();

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
    </div>
  );
};

export default Settings;
