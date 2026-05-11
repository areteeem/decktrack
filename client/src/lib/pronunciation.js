import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_LOCALE = "en-US";
const MAX_GOOGLE_TEXT_LENGTH = 180;
const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";

const LOCALE_ALIASES = {
  en: "en-US",
  english: "en-US",
  "en-us": "en-US",
  "en-gb": "en-GB",
  uk: "uk-UA",
  ua: "uk-UA",
  ukrainian: "uk-UA",
  "uk-ua": "uk-UA",
};

const SUPPORTED_GOOGLE_LANGUAGES = new Set(["en", "uk"]);
const UKRAINIAN_LETTERS_RE = /[іїєґІЇЄҐ]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-z]/;

const SIDE_LOCALE_KEYS = {
  term: [
    "termLocale",
    "term_locale",
    "termLanguage",
    "term_language",
    "frontLocale",
    "front_locale",
    "frontLanguage",
    "front_language",
    "frontLang",
    "front_lang",
    "sourceLocale",
    "source_locale",
    "sourceLanguage",
    "source_language",
  ],
  definition: [
    "definitionLocale",
    "definition_locale",
    "definitionLanguage",
    "definition_language",
    "backLocale",
    "back_locale",
    "backLanguage",
    "back_language",
    "backLang",
    "back_lang",
    "targetLocale",
    "target_locale",
    "targetLanguage",
    "target_language",
  ],
};

const listeners = new Set();

let pronunciationState = {
  status: "idle",
  sourceKey: null,
  text: "",
  locale: null,
  engine: null,
  requestId: 0,
};

let currentToken = 0;
let audioNode = null;
let audioCleanup = null;
let speechCleanup = null;
let fallbackTimer = null;
let voicesPromise = null;

const emit = () => {
  listeners.forEach((listener) => {
    listener(pronunciationState);
  });
};

const updateState = (partial) => {
  pronunciationState = {
    ...pronunciationState,
    ...partial,
  };
  emit();
};

const isBrowser = () => typeof window !== "undefined";

const clearFallbackTimer = () => {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
};

const ensureAudioNode = () => {
  if (!isBrowser()) return null;
  if (!audioNode) {
    audioNode = new Audio();
    audioNode.preload = "none";
  }
  return audioNode;
};

const clearAudioHandlers = () => {
  if (audioCleanup) {
    audioCleanup();
    audioCleanup = null;
  }
};

const clearSpeechHandlers = () => {
  if (speechCleanup) {
    speechCleanup();
    speechCleanup = null;
  }
};

const stopAudioNode = () => {
  const audio = ensureAudioNode();
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
  } catch {}
};

const stopSpeechSynthesis = () => {
  if (!isBrowser() || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel();
  } catch {}
};

const resetPronunciationState = (requestId = currentToken) => {
  updateState({
    status: "idle",
    sourceKey: null,
    text: "",
    locale: null,
    engine: null,
    requestId,
  });
};

const getLanguagePrefix = (locale) => {
  const normalized = normalizeLocale(locale);
  return String(normalized || DEFAULT_LOCALE).split("-")[0].toLowerCase();
};

export const normalizeLocale = (value, fallback = DEFAULT_LOCALE) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback || DEFAULT_LOCALE;
  }

  const lowered = raw.replace(/_/g, "-").toLowerCase();
  if (LOCALE_ALIASES[lowered]) {
    return LOCALE_ALIASES[lowered];
  }

  const parts = lowered.split("-").filter(Boolean);
  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]}-${parts[1].toUpperCase()}`;
};

export const extractPronunciationText = (value) => {
  if (value == null) return "";

  const input = String(value);
  if (!input.trim()) return "";

  if (isBrowser()) {
    const container = document.createElement("div");
    container.innerHTML = input;
    return String(container.textContent || container.innerText || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getSideLocaleValue = (flashcard, side) => {
  if (!flashcard || !side || !SIDE_LOCALE_KEYS[side]) return "";

  for (const key of SIDE_LOCALE_KEYS[side]) {
    const candidate = flashcard[key];
    if (candidate != null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  return "";
};

const getPairLocaleValue = (languagePair, side, fallbackLocale) => {
  const raw = String(languagePair || "").trim();
  if (!raw) return "";

  const explicitSeparator = raw.includes("->")
    ? "->"
    : raw.includes("→")
      ? "→"
      : raw.includes("/")
        ? "/"
        : raw.includes(":")
          ? ":"
          : null;

  let parts = [];
  if (explicitSeparator) {
    parts = raw.split(explicitSeparator).map((part) => part.trim()).filter(Boolean);
  } else if (/^[a-z]{2,5}-[a-z]{2,8}$/i.test(raw)) {
    parts = raw.split("-").map((part) => part.trim()).filter(Boolean);
  }

  if (parts.length !== 2) return "";

  const candidate = side === "definition" ? parts[1] : parts[0];
  if (!candidate || candidate.toLowerCase() === "native") {
    return normalizeLocale(fallbackLocale, DEFAULT_LOCALE);
  }

  return normalizeLocale(candidate, fallbackLocale);
};

const inferLocaleFromText = (text, fallbackLocale) => {
  const plainText = extractPronunciationText(text);
  if (!plainText) return normalizeLocale(fallbackLocale, DEFAULT_LOCALE);

  if (UKRAINIAN_LETTERS_RE.test(plainText)) {
    return "uk-UA";
  }

  if (CYRILLIC_RE.test(plainText)) {
    const normalizedFallback = normalizeLocale(fallbackLocale, DEFAULT_LOCALE);
    return getLanguagePrefix(normalizedFallback) === "uk" ? normalizedFallback : "uk-UA";
  }

  if (LATIN_RE.test(plainText)) {
    const normalizedFallback = normalizeLocale(fallbackLocale, DEFAULT_LOCALE);
    return getLanguagePrefix(normalizedFallback) === "en" ? normalizedFallback : "en-US";
  }

  return normalizeLocale(fallbackLocale, DEFAULT_LOCALE);
};

export const resolvePronunciationLocale = ({ flashcard, side, text, fallbackLocale }) => {
  const explicit = getSideLocaleValue(flashcard, side);
  if (explicit) {
    return normalizeLocale(explicit, fallbackLocale);
  }

  const pairLocale = getPairLocaleValue(flashcard?.language_pair, side, fallbackLocale);
  if (pairLocale) {
    return pairLocale;
  }

  return inferLocaleFromText(text, fallbackLocale);
};

const buildGoogleTtsUrl = (text, locale) => {
  const googleLocale = getLanguagePrefix(locale);
  if (!SUPPORTED_GOOGLE_LANGUAGES.has(googleLocale)) return "";
  if (text.length > MAX_GOOGLE_TEXT_LENGTH) return "";

  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: googleLocale,
    q: text,
  });

  return `${GOOGLE_TTS_URL}?${params.toString()}`;
};

const loadVoices = async () => {
  if (!isBrowser() || !window.speechSynthesis) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices().filter(Boolean);
  if (voices.length > 0) {
    return voices;
  }

  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      const synth = window.speechSynthesis;

      const finish = () => {
        try {
          synth.removeEventListener("voiceschanged", handleVoicesChanged);
        } catch {}
        const resolvedVoices = synth.getVoices().filter(Boolean);
        voicesPromise = Promise.resolve(resolvedVoices);
        resolve(resolvedVoices);
      };

      const handleVoicesChanged = () => finish();

      try {
        synth.addEventListener("voiceschanged", handleVoicesChanged);
      } catch {}

      setTimeout(finish, 1200);
    });
  }

  return voicesPromise;
};

const pickSpeechVoice = async (locale) => {
  const voices = await loadVoices();
  if (!voices.length) return null;

  const normalizedLocale = normalizeLocale(locale, DEFAULT_LOCALE).toLowerCase();
  const languagePrefix = getLanguagePrefix(locale);

  const normalizeVoiceLocale = (voice) => normalizeLocale(voice?.lang || "", DEFAULT_LOCALE).toLowerCase();

  return (
    voices.find((voice) => /google/i.test(String(voice.name || "")) && normalizeVoiceLocale(voice) === normalizedLocale)
    || voices.find((voice) => /google/i.test(String(voice.name || "")) && normalizeVoiceLocale(voice).startsWith(languagePrefix))
    || voices.find((voice) => normalizeVoiceLocale(voice) === normalizedLocale)
    || voices.find((voice) => normalizeVoiceLocale(voice).startsWith(languagePrefix))
    || null
  );
};

const playViaGoogleAudio = async ({ token, text, locale, sourceKey }) => {
  const audio = ensureAudioNode();
  const url = buildGoogleTtsUrl(text, locale);
  if (!audio || !url) return false;

  clearAudioHandlers();
  clearFallbackTimer();

  return new Promise((resolve) => {
    let settled = false;

    const complete = (result) => {
      if (settled) return;
      settled = true;
      clearFallbackTimer();
      resolve(result);
    };

    const handleEnded = () => {
      if (settled || token !== currentToken) return;
      clearAudioHandlers();
      resetPronunciationState(token);
    };

    const handleError = () => {
      if (settled || token !== currentToken) {
        complete(false);
        return;
      }
      clearAudioHandlers();
      complete(false);
    };

    audio.onended = handleEnded;
    audio.onerror = handleError;
    audioCleanup = () => {
      if (audio.onended === handleEnded) audio.onended = null;
      if (audio.onerror === handleError) audio.onerror = null;
    };

    fallbackTimer = setTimeout(() => {
      if (token !== currentToken) {
        complete(false);
        return;
      }
      stopAudioNode();
      clearAudioHandlers();
      complete(false);
    }, 2500);

    try {
      audio.src = url;
      audio.load();

      const playAttempt = audio.play();
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt
          .then(() => {
            if (settled || token !== currentToken) {
              complete(false);
              return;
            }
            updateState({
              status: "playing",
              sourceKey,
              text,
              locale,
              engine: "google",
              requestId: token,
            });
            complete(true);
          })
          .catch(() => {
            if (settled || token !== currentToken) {
              complete(false);
              return;
            }
            clearAudioHandlers();
            complete(false);
          });
      } else {
        updateState({
          status: "playing",
          sourceKey,
          text,
          locale,
          engine: "google",
          requestId: token,
        });
        complete(true);
      }
    } catch {
      clearAudioHandlers();
      complete(false);
    }
  });
};

const playViaSpeechSynthesis = async ({ token, text, locale, sourceKey }) => {
  if (!isBrowser() || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }

  clearSpeechHandlers();

  const synth = window.speechSynthesis;
  const voice = await pickSpeechVoice(locale);
  if (token !== currentToken) return false;

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || normalizeLocale(locale, DEFAULT_LOCALE);
    if (voice) {
      utterance.voice = voice;
    }

    const finish = () => {
      if (token !== currentToken) return;
      clearSpeechHandlers();
      resetPronunciationState(token);
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    speechCleanup = () => {
      utterance.onend = null;
      utterance.onerror = null;
    };

    try {
      synth.cancel();
      updateState({
        status: "playing",
        sourceKey,
        text,
        locale: utterance.lang,
        engine: voice?.name && /google/i.test(voice.name) ? "google-voice" : "speech",
        requestId: token,
      });
      synth.speak(utterance);
      resolve(true);
    } catch {
      clearSpeechHandlers();
      resolve(false);
    }
  });
};

export const getPronunciationState = () => pronunciationState;

export const subscribeToPronunciation = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const stopPronunciation = (sourceKey) => {
  if (sourceKey && pronunciationState.sourceKey && pronunciationState.sourceKey !== sourceKey) {
    return false;
  }

  currentToken += 1;
  clearFallbackTimer();
  clearAudioHandlers();
  clearSpeechHandlers();
  stopAudioNode();
  stopSpeechSynthesis();
  resetPronunciationState(currentToken);
  return true;
};

export const playPronunciation = async ({ text, locale, sourceKey }) => {
  const plainText = extractPronunciationText(text);
  if (!plainText || !sourceKey) return false;

  currentToken += 1;
  const token = currentToken;

  clearFallbackTimer();
  clearAudioHandlers();
  clearSpeechHandlers();
  stopAudioNode();
  stopSpeechSynthesis();

  const resolvedLocale = normalizeLocale(locale, DEFAULT_LOCALE);

  updateState({
    status: "loading",
    sourceKey,
    text: plainText,
    locale: resolvedLocale,
    engine: "google",
    requestId: token,
  });

  const googleSucceeded = await playViaGoogleAudio({
    token,
    text: plainText,
    locale: resolvedLocale,
    sourceKey,
  });

  if (token !== currentToken) {
    return false;
  }

  if (googleSucceeded) {
    return true;
  }

  updateState({
    status: "loading",
    sourceKey,
    text: plainText,
    locale: resolvedLocale,
    engine: "speech",
    requestId: token,
  });

  const speechSucceeded = await playViaSpeechSynthesis({
    token,
    text: plainText,
    locale: resolvedLocale,
    sourceKey,
  });

  if (!speechSucceeded && token === currentToken) {
    resetPronunciationState(token);
  }

  return speechSucceeded;
};

export const usePronunciation = ({ enabled, autoEnabled = false, sourceKey, text, locale }) => {
  const [snapshot, setSnapshot] = useState(getPronunciationState);
  const lastAutoSourceRef = useRef(null);
  const plainText = extractPronunciationText(text);

  useEffect(() => subscribeToPronunciation(setSnapshot), []);

  useEffect(() => {
    if (!enabled) {
      lastAutoSourceRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      stopPronunciation(sourceKey);
    };
  }, [sourceKey]);

  useEffect(() => {
    if (!enabled || !autoEnabled || !plainText || !sourceKey) {
      lastAutoSourceRef.current = null;
      return;
    }

    if (lastAutoSourceRef.current === sourceKey) {
      return;
    }

    lastAutoSourceRef.current = sourceKey;
    playPronunciation({ text: plainText, locale, sourceKey });
  }, [autoEnabled, enabled, locale, plainText, sourceKey]);

  const play = useCallback(() => {
    if (!enabled || !plainText || !sourceKey) {
      return Promise.resolve(false);
    }

    return playPronunciation({ text: plainText, locale, sourceKey });
  }, [enabled, locale, plainText, sourceKey]);

  const stop = useCallback(() => stopPronunciation(sourceKey), [sourceKey]);

  const isCurrentSource = snapshot.sourceKey === sourceKey;

  return {
    canPronounce: enabled && Boolean(plainText),
    isLoading: isCurrentSource && snapshot.status === "loading",
    isPlaying: isCurrentSource && snapshot.status === "playing",
    play,
    stop,
  };
};