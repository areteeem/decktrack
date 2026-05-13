import { toast } from "react-toastify";

const TOAST_DEDUPE_MS = 1800;
const RECENT_TOAST_LIMIT = 80;

let installed = false;
const recentToastKeys = new Map();

const normalizeToastText = (content) => {
  if (content == null) return "";
  if (typeof content === "string" || typeof content === "number") return String(content).trim();
  const children = content?.props?.children;
  if (Array.isArray(children)) return children.map(normalizeToastText).join(" ").trim();
  if (typeof children === "string" || typeof children === "number") return String(children).trim();
  return "";
};

const pruneRecentToastKeys = (now = Date.now()) => {
  for (const [key, timestamp] of recentToastKeys.entries()) {
    if (now - timestamp > TOAST_DEDUPE_MS) {
      recentToastKeys.delete(key);
    }
  }

  if (recentToastKeys.size <= RECENT_TOAST_LIMIT) return;
  const ordered = Array.from(recentToastKeys.entries()).sort((left, right) => left[1] - right[1]);
  const overflow = ordered.length - RECENT_TOAST_LIMIT;
  for (let index = 0; index < overflow; index += 1) {
    recentToastKeys.delete(ordered[index][0]);
  }
};

const wrapToastMethod = (methodName) => {
  if (typeof toast[methodName] !== "function") return;
  const original = toast[methodName].bind(toast);

  toast[methodName] = (content, options) => {
    const normalizedOptions = options && typeof options === "object" ? { ...options } : {};
    const message = normalizeToastText(content).toLowerCase();
    const explicitToastId = normalizedOptions.toastId;
    const dedupeKey = explicitToastId
      ? `${methodName}::id::${String(explicitToastId)}`
      : message
        ? `${methodName}::msg::${message}`
        : "";

    const now = Date.now();
    pruneRecentToastKeys(now);

    if (dedupeKey) {
      const lastShownAt = Number(recentToastKeys.get(dedupeKey) || 0);
      if (now - lastShownAt < TOAST_DEDUPE_MS) return explicitToastId || dedupeKey;
      recentToastKeys.set(dedupeKey, now);
      if (!explicitToastId) normalizedOptions.toastId = dedupeKey;
    }

    return original(content, normalizedOptions);
  };
};

export function installToastLifecycleOptimizations() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;

  ["success", "error", "info", "warn", "warning"].forEach(wrapToastMethod);

  const syncToastLifecycle = () => {
    pruneRecentToastKeys();
    if (document.visibilityState === "visible" && (typeof document.hasFocus !== "function" || document.hasFocus())) {
      toast.clearWaitingQueue?.();
    }
  };

  syncToastLifecycle();
  document.addEventListener("visibilitychange", syncToastLifecycle);
  window.addEventListener("focus", syncToastLifecycle);
  window.addEventListener("pageshow", syncToastLifecycle);
}
