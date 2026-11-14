// Interest and goal options shown during onboarding. Interest labels match the
// activity types hosts pick in the Create form so they can be compared directly.

export const INTEREST_GROUPS = Object.freeze([
  { title: 'Court & field', items: ['Basketball', 'Volleyball', 'Beach volleyball', 'Soccer', 'Futsal', 'Flag football', 'Frisbee', 'Dodgeball'] },
  { title: 'Racquet sports', items: ['Pickleball', 'Badminton', 'Racquetball'] },
  { title: 'Move & recharge', items: ['Running', 'Swimming', 'Climbing'] },
  { title: 'Social & study', items: ['Study group', 'Coffee', 'Food and dining', 'Downtown hangout', 'Arts and culture', 'Other social'] }
]);

export const INTERESTS = Object.freeze(INTEREST_GROUPS.flatMap(g => g.items));

export const SOCIAL_INTERESTS = Object.freeze(new Set(INTEREST_GROUPS[3].items));

export const GOALS = Object.freeze([
  { id: 'meet_people', label: 'Meet new people', emoji: '👋' },
  { id: 'stay_active', label: 'Stay active', emoji: '🏃' },
  { id: 'try_new', label: 'Try something new', emoji: '✨' },
  { id: 'study', label: 'Study with others', emoji: '📚' },
  { id: 'unwind', label: 'Unwind & destress', emoji: '🌿' },
  { id: 'compete', label: 'Get competitive', emoji: '🏆' }
]);

export const MIN_INTERESTS = 3;
