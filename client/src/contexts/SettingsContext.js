import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getTranslations } from "../lib/i18n";
import { stopPronunciation } from "../lib/pronunciation";

const SettingsContext = createContext({
  srsMode: "simple",
  setSrsMode: () => {},
  locale: "en",
  setLocale: () => {},
  pronunciationEnabled: false,
  setPronunciationEnabled: () => {},
  autoPronounce: false,
  setAutoPronounce: () => {},
  t: (k) => k,
});

const STORAGE_KEY = "flashy.settings";

const DEFAULT_SETTINGS = {
  srsMode: "simple", // "simple" (Again/Know) or "full" (Again/Hard/Good/Easy)
  locale: "en",      // "en" or "uk"
  pronunciationEnabled: false,
  autoPronounce: false,
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    if (!settings.pronunciationEnabled) {
      stopPronunciation();
    }
  }, [settings.pronunciationEnabled]);

  const setSrsMode = useCallback((mode) => {
    setSettings((prev) => ({ ...prev, srsMode: mode }));
  }, []);

  const setLocale = useCallback((locale) => {
    setSettings((prev) => ({ ...prev, locale }));
  }, []);

  const setPronunciationEnabled = useCallback((pronunciationEnabled) => {
    setSettings((prev) => ({ ...prev, pronunciationEnabled }));
  }, []);

  const setAutoPronounce = useCallback((autoPronounce) => {
    setSettings((prev) => ({ ...prev, autoPronounce }));
  }, []);

  const { t } = useMemo(() => getTranslations(settings.locale), [settings.locale]);

  return (
    <SettingsContext.Provider value={{
      srsMode: settings.srsMode,
      setSrsMode,
      locale: settings.locale,
      setLocale,
      pronunciationEnabled: settings.pronunciationEnabled,
      setPronunciationEnabled,
      autoPronounce: settings.autoPronounce,
      setAutoPronounce,
      t,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
