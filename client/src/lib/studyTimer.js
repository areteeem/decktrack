/**
 * Study timer — tracks total study time per student in localStorage.
 *
 * Key: flashy.studyTime
 * Shape: { totalSeconds: number, lastTick: ISO | null }
 *
 * Call tick() while in a study page to accumulate time.
 * Call stop() when leaving a study page.
 * Call getTotalTime() to read the formatted string.
 */

const KEY = 'flashy.studyTime';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { totalSeconds: 0, lastTick: null };
  } catch {
    return { totalSeconds: 0, lastTick: null };
  }
};

const save = (data) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
};

/** Call every ~1s while studying to accumulate time */
export const tick = () => {
  const data = load();
  const now = Date.now();
  if (data.lastTick) {
    const elapsed = (now - new Date(data.lastTick).getTime()) / 1000;
    // Only count if gap < 5s (prevents jumps from tab inactivity)
    if (elapsed > 0 && elapsed < 5) {
      data.totalSeconds += elapsed;
    }
  }
  data.lastTick = new Date(now).toISOString();
  save(data);
  return data.totalSeconds;
};

/** Call when leaving study mode */
export const stop = () => {
  const data = load();
  data.lastTick = null;
  save(data);
};

/** Get total seconds studied */
export const getTotalSeconds = () => load().totalSeconds;

/** Format seconds as "Xh Ym" or "Ym" */
export const formatStudyTime = (seconds) => {
  if (!seconds || seconds < 60) return seconds > 0 ? "<1m" : "0m";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  return `${mins}m`;
};
