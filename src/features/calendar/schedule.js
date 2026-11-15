export function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  next.setHours(0, 0, 0, 0);
  return next;
}

// Clip overnight events to each visible local day; use wall time for the grid.
export function daySegments(items, day) {
  const start = addDays(day, 0), end = addDays(day, 1);
  const minutes = d => d.getHours() * 60 + d.getMinutes();
  return items.flatMap(item => {
    const from = new Date(item.starts_at), to = new Date(item.ends_at || from.getTime() + 3600000);
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from || from >= end || to <= start) return [];
    return [{ ...item, start: from <= start ? 0 : minutes(from), end: to >= end ? 1440 : minutes(to) }];
  });
}

export function weeklySegments(entries, day) {
  const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  return entries.filter(e => e.weekday === day.getDay()).map(e => ({ ...e, start: minutes(e.start_time), end: minutes(e.end_time) })).filter(e => e.end > e.start);
}

export function mergeBusy(segments) {
  const merged = [];
  for (const s of [...segments].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ start: s.start, end: s.end });
  }
  return merged;
}

// Give every event in an overlapping cluster its own tappable lane.
export function layoutEvents(segments) {
  const result = [], groups = [];
  for (const event of [...segments].sort((a, b) => a.start - b.start || b.end - a.end)) {
    let group = groups.at(-1);
    if (!group || event.start >= group.end) { group = { end: event.end, items: [], lanes: [] }; groups.push(group); }
    const lane = group.lanes.findIndex(end => end <= event.start);
    const column = lane < 0 ? group.lanes.length : lane;
    group.lanes[column] = event.end;
    group.end = Math.max(group.end, event.end);
    group.items.push({ ...event, column });
  }
  for (const group of groups) result.push(...group.items.map(e => ({ ...e, columns: group.lanes.length })));
  return result;
}
