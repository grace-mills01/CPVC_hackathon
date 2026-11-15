export const profileRoutes = {'events-attending':'/profile/events/attending','events-hosting':'/profile/events/hosting','activity-log':'/profile/activity-log',profile:'/profile'};
export function pageFromHash(hash){return Object.keys(profileRoutes).find(page=>'#'+profileRoutes[page]===hash)||'discover';}
export function eventViews(games,roster,userId,now=new Date()){
 const joined=new Set(roster.filter(r=>r.user_id===userId).map(r=>r.game_id));
 const mine=games.filter(g=>g.status==='scheduled'&&(g.host_id===userId||joined.has(g.id)));
 const upcoming=mine.filter(g=>new Date(g.starts_at)>now).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
 return {attending:upcoming.filter(g=>g.host_id!==userId),hosting:upcoming.filter(g=>g.host_id===userId),past:mine.filter(g=>new Date(g.ends_at||g.starts_at)<=now).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at))};
}
export function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function monthDays(month){
 const first=new Date(month.getFullYear(),month.getMonth(),1),last=new Date(month.getFullYear(),month.getMonth()+1,0);
 return Array.from({length:Math.ceil((first.getDay()+last.getDate())/7)*7},(_,i)=>i<first.getDay()||i>=first.getDay()+last.getDate()?null:new Date(first.getFullYear(),first.getMonth(),i-first.getDay()+1));
}
