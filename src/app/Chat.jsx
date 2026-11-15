import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import './chat.css';

export default function Chat({ game, messages, userId, count, onBack, onDetails, onSend }) {
 const list = useRef(null);
 const [draft, setDraft] = useState('');
 const [sending, setSending] = useState(false);
 const lastId = messages.at(-1)?.id;
 useEffect(() => { if(list.current) list.current.scrollTop = list.current.scrollHeight; }, [lastId]);
 async function submit(event) {
  event.preventDefault();
  if(sending || !draft.trim()) return;
  setSending(true);
  try { if(await onSend(event)) setDraft(''); }
  finally { setSending(false); }
 }
 return <section className="chat-page" aria-label={`${game.title} conversation`}>
  <header className="chat-header">
   <Button variant="icon" className="chat-back" onClick={onBack} aria-label="Back to messages"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></Button>
   <div className="chat-heading"><h2>{game.title}</h2><p>{count} {count===1?'member':'members'}</p></div>
   <Button variant="icon" className="chat-details" onClick={onDetails} aria-label="View activity details"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></Button>
  </header>
  <div className="chat-history" ref={list} role="log" aria-label="Group messages" aria-live="polite" aria-relevant="additions">
   {messages.length ? messages.map(message => {
    const own = message.sender_id===userId;
    const name = message.profiles?.display_name || 'Player';
    return <article className={`chat-message${own?' chat-message-own':''}`} key={message.id}>
     {!own && <div className="chat-avatar" aria-hidden="true">{message.profiles?.avatar_url?<img src={message.profiles.avatar_url} alt=""/>:name.trim().slice(0,1).toUpperCase()}</div>}
     <div className="chat-message-content">
      {!own && <div className="chat-sender">{name}{message.sender_id===game.host_id?' (Host)':''}</div>}
      <div className="chat-bubble"><p>{message.body}</p></div>
      <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time>
     </div>
    </article>;
   }) : <div className="chat-empty"><p>Make a plan. Say hello.</p><span>This is your space to coordinate with the group.</span></div>}
  </div>
  <form className="chat-composer" onSubmit={submit}>
   <input name="body" aria-label="Message the group" placeholder="Message the group…" autoComplete="off" required maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={sending}/>
   <Button variant="send" type="submit" className="chat-send" disabled={sending||!draft.trim()} aria-label={sending?'Sending message':'Send message'}><svg viewBox="0 0 25 24" aria-hidden="true"><path d="m4 3 17 9-17 9 4-9-4-9Zm4 9h13"/></svg></Button>
  </form>
 </section>;
}
