import React, {useState} from 'react';
import Button from '../components/Button.jsx';
import {requestPasswordReset, updatePassword} from '../lib/passwordReset.js';

export default function PasswordReset({auth, recovery, ready, session, onBack}) {
 const [busy,setBusy]=useState(false), [error,setError]=useState(''), [sent,setSent]=useState(false), [done,setDone]=useState(false);
 async function submit(event) {
  event.preventDefault();
  if(busy)return;
  const form=event.currentTarget, data=new FormData(form);
  setBusy(true);setError('');
  try {
   if(recovery){
    if(!session)throw new Error('Your reset link has expired. Request a new email.');
    await updatePassword(auth,data.get('password'),data.get('confirmation'));
    form.reset();setDone(true);
   } else {
    await requestPasswordReset(auth,data.get('email'),window.location);
    setSent(true);
   }
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="welcome password-reset">
  <h2>{done?'Password updated':recovery?'Set a new password':'Reset your password'}</h2>
  {error&&<p className="alert" role="alert">{error}</p>}
  {done?<><p role="status">Your password has been updated. You can now continue to ToGo.</p><Button variant="primary" onClick={onBack}>Continue to ToGo</Button></>:recovery&&!ready?<p role="status">Checking your reset link…</p>:recovery&&!session?<><p role="alert">This reset link is invalid or has expired. Request a new reset email to try again.</p><Button variant="primary" onClick={()=>{window.location.assign(window.location.pathname+'?forgot=1')}}>Request a new link</Button></>:<>
   <p>{recovery?'Enter your new password twice to confirm it.':'Enter your account email and we’ll send you a link to reset your password.'}</p>
   {sent&&<p role="status">If an account exists for that email, you’ll receive a password reset link. Check your inbox and spam folder.</p>}
   <form onSubmit={submit}>
    {recovery?<><label>New password<input required type="password" name="password" autoComplete="new-password" minLength="6" disabled={busy}/></label><label>Confirm new password<input required type="password" name="confirmation" autoComplete="new-password" minLength="6" disabled={busy}/></label></>:<label>Email<input required type="email" name="email" autoComplete="email" disabled={busy}/></label>}
    <Button variant="primary" type="submit" disabled={busy}>{busy?'Please wait…':recovery?'Update password':sent?'Send another reset email':'Send reset email'}</Button>
   </form>
  </>}
  {!done&&<Button variant="quiet" type="button" disabled={busy} onClick={onBack}>{session?'Back to ToGo':'Back to sign in'}</Button>}
 </section>;
}
