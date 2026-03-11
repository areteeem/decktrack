import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyStudentAppBridge } from '../lib/studentAppBridge';
import { normalizeStudentId } from '../lib/tutproRoster';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const buildDisplayName = useCallback((authUser, flashyProfile, teacherProfile) => {
    const teacherDisplayName = teacherProfile?.display_name?.trim();
    const flashyDisplayName = flashyProfile?.display_name?.trim();
    const metadataDisplayName = authUser?.user_metadata?.display_name?.trim();
    const emailPrefix = authUser?.email?.split('@')?.[0]?.trim();

    return (
      teacherDisplayName ||
      flashyDisplayName ||
      metadataDisplayName ||
      emailPrefix ||
      ''
    );
  }, []);

  // Fetch or create flashy_profiles row for current user, syncing role from teacher_profiles
  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser?.id) {
      setProfile(null);
      return null;
    }

    const [{ data: flashyProfile, error: flashyError }, { data: teacherProfile, error: teacherError }] = await Promise.all([
      supabase
        .from('flashy_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('teacher_profiles')
        .select('user_id, email, display_name')
        .eq('user_id', authUser.id)
        .maybeSingle(),
    ]);

    if (flashyError) {
      console.error('[Flashy] Profile fetch error:', flashyError.message);
      setProfile(null);
      return null;
    }

    if (teacherError) {
      console.error('[Flashy] Teacher profile fetch error:', teacherError.message);
    }

    const resolvedRole = teacherProfile
      ? 'teacher'
      : flashyProfile?.role || authUser?.user_metadata?.flashy_role || 'student';

    const resolvedEmail = (teacherProfile?.email || flashyProfile?.email || authUser?.email || '').trim();
    const resolvedDisplayName = buildDisplayName(authUser, flashyProfile, teacherProfile);

    if (!flashyProfile) {
      const insertPayload = {
        id: authUser.id,
        role: resolvedRole,
        teacher_id: resolvedRole === 'teacher' ? null : null,
        email: resolvedEmail,
        display_name: resolvedDisplayName,
      };

      const { data: insertedProfile, error: insertError } = await supabase
        .from('flashy_profiles')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertError) {
        console.error('[Flashy] Profile bootstrap insert error:', insertError.message);
        setProfile(insertPayload);
        return insertPayload;
      }

      setProfile(insertedProfile);
      return insertedProfile;
    }

    const updates = {};

    if (flashyProfile.role !== resolvedRole) {
      updates.role = resolvedRole;
    }

    if (resolvedRole === 'teacher' && flashyProfile.teacher_id) {
      updates.teacher_id = null;
    }

    if (resolvedEmail && flashyProfile.email !== resolvedEmail) {
      updates.email = resolvedEmail;
    }

    if (resolvedDisplayName && flashyProfile.display_name !== resolvedDisplayName) {
      updates.display_name = resolvedDisplayName;
    }

    if (Object.keys(updates).length === 0) {
      setProfile(flashyProfile);
      return flashyProfile;
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('flashy_profiles')
      .update(updates)
      .eq('id', authUser.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[Flashy] Profile bootstrap update error:', updateError.message);
      const mergedProfile = { ...flashyProfile, ...updates };
      setProfile(mergedProfile);
      return mergedProfile;
    }

    setProfile(updatedProfile);
    return updatedProfile;
  }, [buildDisplayName]);

  // Update last_active_at
  const touchActive = useCallback(async (userId) => {
    if (!userId) return;
    await supabase
      .from('flashy_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);
  }, []);

  useEffect(() => {
    let subscription;
    let timeoutId;

    const init = async () => {
      try {
        // Get existing session
        const { data: { session: existing }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[Flashy] getSession error:', sessionError.message);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setSession(existing);
        if (existing?.user) {
          await fetchProfile(existing.user);
          touchActive(existing.user.id);
        }
      } catch (err) {
        console.warn('[Flashy] Auth init error:', err);
        setSession(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }

      // Listen for auth changes
      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          await fetchProfile(newSession.user);
          touchActive(newSession.user.id);
        } else {
          setProfile(null);
        }
      });
      subscription = data?.subscription;
    };

    // Safety timeout: if init takes too long, force loading=false
    timeoutId = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('[Flashy] Auth init timed out, forcing loading=false');
          return false;
        }
        return current;
      });
    }, 8000);

    init();
    return () => {
      clearTimeout(timeoutId);
      subscription?.unsubscribe?.();
    };
  }, [fetchProfile, touchActive]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  };

  const signInAnonymously = async (metadata = {}) => {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: metadata,
      },
    });
    if (error) throw error;
    return data;
  };

  /* ── Token-based student auth ─────────────────────── */
  const toSafeStudentKey = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const slug = raw
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'student';

    let hash = 2166136261;
    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return `${slug}-${(hash >>> 0).toString(36)}`;
  };

  const deriveStudentEmail = (token) => `${toSafeStudentKey(token)}@flashyapp.com`;
  const deriveStudentPassword = (token) => `flashy_${toSafeStudentKey(token)}_2025`;

  /**
   * Generate a random 8-char alphanumeric token.
   */
  const generateToken = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars
    let token = '';
    for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  };

  /**
   * Sign up a new student account with a random token.
   * Returns { user, session, token }.
   */
  const signUpStudent = async (displayName, studentId) => {
    const token = generateToken();
    const email = deriveStudentEmail(token);
    const password = deriveStudentPassword(token);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          flashy_role: 'student',
          display_name: displayName || '',
          ...(studentId ? { student_id: studentId } : {}),
          login_token: token,
        },
      },
    });
    if (error) throw error;

    // If session is null (email confirmation required), try signIn immediately
    if (!data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      return { ...signInData, token };
    }
    return { ...data, token };
  };

  /**
   * Sign in an existing student using their login token.
   */
  const signInWithToken = async (token) => {
    const email = deriveStudentEmail(token);
    const password = deriveStudentPassword(token);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  /**
   * Full student login flow: verify Name + ID against backup, then
   * create or sign into a Supabase Auth account tied to that student.
   */
  const signInStudent = async (studentName, studentId) => {
    const normalizedStudentId = normalizeStudentId(studentId);

    const { data: authSeed, error: authSeedError } = await supabase.rpc('flashy_prepare_student_auth', {
      login_name: String(studentName || '').trim(),
      login_student_id: normalizedStudentId,
    });

    if (authSeedError) {
      const loweredMessage = String(authSeedError.message || '').toLowerCase();
      if (loweredMessage.includes('flashy_prepare_student_auth')) {
        throw new Error('Student login setup is missing in Supabase. Run migration 006 and try again.');
      }
      throw authSeedError;
    }

    const preparedAuth = Array.isArray(authSeed) ? authSeed[0] : authSeed;
    if (!preparedAuth?.email || !preparedAuth?.password) {
      throw new Error('Could not prepare student sign-in.');
    }

    const finalizeStudentSignIn = async (authData) => {
      await applyStudentAppBridge({
        teacherId: preparedAuth.teacher_id,
        studentId: preparedAuth.student_id || normalizedStudentId,
        studentName: preparedAuth.student_name || String(studentName || '').trim(),
      });
      return authData;
    };

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: preparedAuth.email,
      password: preparedAuth.password,
    });

    if (signInError) {
      throw signInError;
    }

    return finalizeStudentSignIn(signInData);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = () => fetchProfile(session?.user);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
    isAuthenticated: !!session,
    loading,
    signIn,
    signUp,
    signInAnonymously,
    signUpStudent,
    signInWithToken,
    signInStudent,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
