import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';

const localPath = (value) => String(value || '').startsWith('/') && !String(value).startsWith('//') ? String(value) : '/';

export default function SsoCallback() {
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const code = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('sso');
        if (!code) throw new Error('The sign-in handoff is missing.');
        const supabase = getSupabase();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sso_consume`, { method: 'POST', headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const handoff = await response.json().catch(() => ({}));
        if (!response.ok || !handoff.tokenHash) throw new Error(handoff.error || 'The sign-in handoff expired.');
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: handoff.tokenHash, type: 'magiclink' });
        if (verifyError) throw verifyError;
        window.location.replace(localPath(handoff.returnPath));
      } catch (cause) { if (active) setError(cause?.message || 'Could not finish signing in.'); }
    })();
    return () => { active = false; };
  }, []);
  return <main className="auth-loading">{error || 'Finishing secure sign-in…'}</main>;
}
