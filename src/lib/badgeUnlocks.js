// Unseen earned badges are celebrated on the next profile visit, including first use.
export function badgeUnlocks(earned, previous) {
  const known = new Set(Array.isArray(previous) ? previous.filter(id => typeof id === 'string') : []);
  const fresh = earned.filter(badge => !known.has(badge.id));
  earned.forEach(badge => known.add(badge.id));
  return {fresh, seen: [...known]};
}
export function readBadgeHistory(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : null;
  } catch { return null; }
}
