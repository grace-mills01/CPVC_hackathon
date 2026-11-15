import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { consumeGoogleReturn, loadOwnProfile, refreshCalendarFeedIfStale } from './api.js';
import Onboarding from './Onboarding.jsx';

export const EDIT_PREFERENCES_EVENT = 'togo:edit-preferences';

/** Opens one onboarding step from anywhere: 'interests' or 'calendar'. */
export function editPreferences(step = 'interests') {
  window.dispatchEvent(new CustomEvent(EDIT_PREFERENCES_EVENT, { detail: { step } }));
}

/**
 * Shows onboarding to signed-in users who haven't finished it, and the app
 * otherwise. Wraps <App/> in main.jsx so the app itself needs no changes.
 */
export default function OnboardingGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [editStep, setEditStep] = useState(null);
  const [returnedFromGoogle, setReturnedFromGoogle] = useState(() => supabase ? consumeGoogleReturn() : false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const open = e => setEditStep(e.detail?.step || 'interests');
    window.addEventListener(EDIT_PREFERENCES_EVENT, open);
    return () => { subscription.unsubscribe(); window.removeEventListener(EDIT_PREFERENCES_EVENT, open); };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setProfile(undefined); return; }
    let live = true;
    loadOwnProfile(userId).then(p => live && setProfile(p), () => live && setProfile(null));
    refreshCalendarFeedIfStale();
    return () => { live = false; };
  }, [userId]);

  if (!supabase || session === null) return children;
  if (session === undefined || profile === undefined) return <main className="onb-loading" aria-busy="true" />;
  const onboarded = Boolean(profile?.onboarded_at);
  const screen = (editStep || returnedFromGoogle || !onboarded) && <Onboarding
    key={editStep || 'onboarding'}
    session={session}
    profile={profile}
    returnedFromGoogle={returnedFromGoogle}
    editStep={editStep}
    onDone={p => { if (p) setProfile(p); setEditStep(null); setReturnedFromGoogle(false); }}
  />;
  if (!screen) return children;
  // First-time setup replaces the app; edits open on top so closing returns to the same page.
  return onboarded ? <>{children}<div className="onb-overlay">{screen}</div></> : screen;
}
