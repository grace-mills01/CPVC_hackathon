const TIME_ZONE = 'America/Los_Angeles';
const normalize = value => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Achievements reflect completed, non-canceled activities in the user's roster.
export function activityBadges(games, roster, userId, now = new Date()) {
  if (!userId) return {earned: [], hours: 0, hosted: 0, participated: 0, biggest: 0};
  const members = new Map();
  for (const row of roster) {
    if (!members.has(row.game_id)) members.set(row.game_id, new Set());
    members.get(row.game_id).add(row.user_id);
  }
  const completed = [...new Map(games.map(game => [game.id, game])).values()].filter(game =>
    game.status === 'scheduled' && members.get(game.id)?.has(userId) &&
    Number.isFinite(Date.parse(game.starts_at)) && new Date(game.ends_at || game.starts_at) <= now);
  const hosted = completed.filter(game => game.host_id === userId).length;
  const participated = completed.length;
  const hours = completed.reduce((sum, game) => {
    const duration = Date.parse(game.ends_at) - Date.parse(game.starts_at);
    return sum + (Number.isFinite(duration) && duration > 0 ? duration / 3600000 : 0);
  }, 0);
  const biggest = Math.max(0, ...completed.map(game => members.get(game.id).size));
  const earned = [];
  const add = (id, name, description, icon, tone, detail) => earned.push({id, name, description, icon, tone, detail});
  const milestones = (value, step, prefix, name, unit, icon, tone) => {
    for (let target = step; target <= value; target += step)
      add(`${prefix}-${target}`, `${name} ${target}`, `Complete ${target} ${unit}.`, icon, tone, `${target} ${unit}`);
  };
  milestones(hours, 50, 'hours', 'Time Well Spent', 'activity hours', 'clock', 'gold');
  milestones(hosted, 10, 'host', 'The Gatherer', 'hosted activities', 'flag', 'coral');
  milestones(participated, 15, 'joined', 'Showing Up', 'activities', 'star', 'mint');
  const types = new Map();
  for (const game of completed) if (normalize(game.sport)) types.set(normalize(game.sport), game.sport.trim());
  for (const [key, label] of [...types].sort(([a], [b]) => a.localeCompare(b)))
    add(`try-${key}`, label, `Complete your first ${label} activity.`, 'spark', 'blue', 'First activity tried');
  for (const target of [5, 10, 25, 50, 100]) if (biggest >= target)
    add(`crowd-${target}`, target === 5 ? 'Better Together' : target === 10 ? 'In Good Company' : `Crowd Favorite ${target}`, `Complete an activity with at least ${target} people, including you.`, 'people', 'purple', `${target}+ people together`);
  const localMinutes = game => {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(game.starts_at));
    return Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
  };
  if (completed.some(game => localMinutes(game) > 23 * 60))
    add('night', 'Night Dweller', 'Complete an activity starting after 11 pm Pacific time.', 'moon', 'purple', 'After-hours adventurer');
  if (completed.some(game => localMinutes(game) < 5 * 60))
    add('early', 'Early Bird', 'Complete an activity starting before 5 am Pacific time.', 'sun', 'gold', 'Up before the sun');
  const study = completed.filter(game => /\bstudy\b|\bstudying\b/i.test(game.sport || '')).length;
  if (study >= 5) add('study', 'Geek Squad', 'Complete five study sessions.', 'book', 'blue', '5 study sessions');
  if (types.size >= 5) add('explorer', 'Comfort Zone Who?', 'Try five different activity types.', 'compass', 'coral', '5 ways to get out there');
  return {earned, hours, hosted, participated, biggest};
}
