export function profileActivity(games, roster, userId, now = new Date()) {
  const joined = new Set(roster.filter(row => row.user_id === userId).map(row => row.game_id));
  const active = games.filter(game => joined.has(game.id) && game.status === 'scheduled');
  const past = active.filter(game => new Date(game.ends_at || game.starts_at) <= now);
  const pastIds = new Set(past.map(game => game.id));
  return {
    upcoming: active.filter(game => new Date(game.starts_at) > now).sort((a,b) => new Date(a.starts_at)-new Date(b.starts_at)),
    sports: new Set(past.map(game => game.sport.trim().toLowerCase())).size,
    sessions: past.length,
    people: new Set(roster.filter(row => pastIds.has(row.game_id) && row.user_id !== userId).map(row => row.user_id)).size,
  };
}
