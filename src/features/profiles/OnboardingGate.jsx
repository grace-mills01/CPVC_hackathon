import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { consumeGoogleReturn, loadOwnProfile } from './api.js';
import Onboarding from './Onboarding.jsx';

/** Opens onboarding again from anywhere, e.g. an "Edit interests" button. */
export const EDIT_PREFERENCES_EVENT = 'togo:edit-preferences';
export function editPreferences() { window.dispatchEvent(new Event(EDIT_PREFERENCES_EVENT)); }

/**
 * Shows onboarding to signed-in users who haven't finished it, and the app
 * otherwise. Wraps <App/> in main.jsx so the app itself needs no changes.
 */
export default function OnboardingGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [returnedFromGoogle, setReturnedFromGoogle] = useState(() => supabase ? consumeGoogleReturn() : false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const open = () => setEditing(true);
    window.addEventListener(EDIT_PREFERENCES_EVENT, open);
    return () => { subscription.unsubscribe(); window.removeEventListener(EDIT_PREFERENCES_EVENT, open); };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setProfile(undefined); return; }
    let live = true;
    loadOwnProfile(userId).then(p => live && setProfile(p), () => live && setProfile(null));
    return () => { live = false; };
  }, [userId]);

  if (!supabase || session === null) return children;
  if (session === undefined || profile === undefined) return <main className="onb-loading" aria-busy="true" />;
  if (editing || returnedFromGoogle || !profile?.onboarded_at) {
    return <Onboarding
      session={session}
      profile={profile}
      returnedFromGoogle={returnedFromGoogle}
      onDone={p => { setProfile(p); setEditing(false); setReturnedFromGoogle(false); }}
    />;
  }
  return children;
}
