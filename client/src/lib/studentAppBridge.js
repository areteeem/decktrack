import { supabase } from './supabaseClient';
import { normalizeStudentId } from './tutproRoster';
import { STORAGE_KEYS } from './storageKeys';

const BRIDGE_STORAGE_KEY = STORAGE_KEYS.studentAppBridge;
const BRIDGE_TTL_MS = 30 * 60 * 1000;

const isSettingsObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
);

const normalizeLaunchData = (payload) => ({
  teacherId: String(payload?.teacherId || '').trim(),
  studentId: normalizeStudentId(payload?.studentId),
  studentName: String(payload?.studentName || '').trim(),
});

export const clearStudentAppBridge = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BRIDGE_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};

export const storeStudentAppBridge = (payload) => {
  if (typeof window === 'undefined') return;

  const normalized = normalizeLaunchData(payload);
  if (!normalized.teacherId || !normalized.studentId || !normalized.studentName) return;

  try {
    localStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify({
      ...normalized,
      createdAt: Date.now(),
    }));
  } catch {
    // Ignore storage errors.
  }
};

export const getStudentAppBridge = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    const createdAt = Number(parsed?.createdAt || 0);
    if (!createdAt || Date.now() - createdAt > BRIDGE_TTL_MS) {
      clearStudentAppBridge();
      return null;
    }

    const normalized = normalizeLaunchData(parsed);
    return normalized.teacherId && normalized.studentId && normalized.studentName
      ? normalized
      : null;
  } catch {
    clearStudentAppBridge();
    return null;
  }
};

export const applyStudentAppBridge = async (payload) => {
  const normalized = normalizeLaunchData(payload);
  if (!normalized.teacherId || !normalized.studentId || !normalized.studentName) {
    return false;
  }

  const { data: userResponse } = await supabase.auth.getUser();
  const activeUser = userResponse?.user;
  if (!activeUser?.id) {
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from('flashy_profiles')
    .select('id, role, settings')
    .eq('id', activeUser.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.role === 'teacher') return false;

  const settings = {
    ...(isSettingsObject(profile?.settings) ? profile.settings : {}),
    tutproStudentId: normalized.studentId,
    studentAppTeacherId: normalized.teacherId,
    launchSource: 'student-app',
    lastStudentAppLaunchAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('flashy_profiles')
    .update({
      role: 'student',
      teacher_id: normalized.teacherId,
      display_name: normalized.studentName,
      settings,
    })
    .eq('id', activeUser.id);

  if (updateError) throw updateError;

  clearStudentAppBridge();
  return true;
};

export const applyPendingStudentAppBridge = async () => {
  const pendingBridge = getStudentAppBridge();
  if (!pendingBridge) return false;
  return applyStudentAppBridge(pendingBridge);
};
