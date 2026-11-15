const TIME_ZONE = 'America/Los_Angeles';
const normalize = value => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function activityBadgeIcon(activity) {
  const name = normalize(activity);
  const rules = [
    [/basketball/, 'basketball'], [/volley/, 'volleyball'], [/soccer|futsal/, 'soccer'],
    [/football/, 'football'], [/pickleball|ping pong|table tennis/, 'paddle'],
    [/badminton/, 'shuttle'], [/tennis|racquet|squash/, 'racket'], [/dodgeball/, 'ball'],
    [/frisbee|ultimate/, 'disc'], [/running|jog|walk/, 'shoe'], [/swim|surf/, 'waves'],
    [/climb|boulder/, 'mountain'], [/hike|hiking/, 'trail'], [/study|studying/, 'book'],
    [/coffee|tea/, 'cup'], [/food|dining|cook/, 'utensils'], [/downtown|hangout/, 'city'],
    [/art|culture|paint|draw/, 'palette'], [/cycl|bik/, 'bike'], [/yoga|fitness|gym/, 'fitness'],
    [/music|concert/, 'music'], [/social/, 'people'],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] || 'spark';
}

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
    add(`try-${key}`, label, `Complete your first ${label} activity.`, activityBadgeIcon(label), 'blue', 'First activity tried');
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
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit'});
  const days = new Map();
  const companions = new Map();
  const venues = new Set();
  for (const game of completed) {
    const parts = dayFormatter.formatToParts(new Date(game.starts_at));
    const part = type => parts.find(p => p.type === type).value;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    if (!days.has(date)) days.set(date, new Set());
    if (normalize(game.sport)) days.get(date).add(normalize(game.sport));
    if (normalize(game.venue)) venues.add(normalize(game.venue));
    for (const person of members.get(game.id)) if (person !== userId)
      companions.set(person, (companions.get(person) || 0) + 1);
  }
  if ([...days.values()].some(types => types.size >= 3))
    add('hat-trick', 'Hat Trick', 'Complete three different activity types in one Pacific calendar day.', 'hat', 'gold', '3 types. One day.');
  if ([...companions.values()].some(count => count >= 5))
    add('familiar-faces', 'Familiar Faces', 'Complete five activities with the same other person.', 'heart', 'coral', 'From strangers to regulars');
  if (venues.size >= 5)
    add('around-town', 'Around Town', 'Complete activities at five different venues.', 'pin', 'mint', '5 places. More stories.');
  if ([...days.keys()].some(date => {
    const saturday = new Date(`${date}T12:00:00Z`);
    if (saturday.getUTCDay() !== 6) return false;
    saturday.setUTCDate(saturday.getUTCDate() + 1);
    return days.has(saturday.toISOString().slice(0, 10));
  })) add('weekend', 'Weekend Warrior', 'Complete activities on Saturday and Sunday of the same weekend, Pacific time.', 'calendar', 'purple', 'A weekend well spent');
  return {earned, hours, hosted, participated, biggest};
}
