/**
 * Domain shapes for the planned app. IDs are UUID strings and times are ISO 8601
 * strings with timezones. These describe data; they do not validate inputs.
 * @typedef {'all_levels' | 'beginner' | 'intermediate' | 'advanced'} SkillLevel
 * @typedef {'scheduled' | 'canceled'} GameStatus
 * @typedef {{id: string, display_name: string, bio: string | null, created_at: string, updated_at: string}} Profile
 * @typedef {{id: string, name: string, slug: string}} Sport
 * @typedef {{user_id: string, sport_id: string, skill_level: SkillLevel | null}} UserSport
 * @typedef {{id: string, name: string, address: string | null, latitude: number | null, longitude: number | null}} Venue
 * @typedef {{id: string, host_id: string, sport_id: string, venue_id: string, title: string, description: string | null, starts_at: string, ends_at: string, capacity: number, skill_level: SkillLevel, status: GameStatus, created_at: string, updated_at: string}} Game
 * @typedef {{game_id: string, user_id: string, joined_at: string}} GameParticipant
 * @typedef {{id: string, game_id: string, sender_id: string, body: string, created_at: string}} GameMessage
 */
export const SKILL_LEVELS = Object.freeze(['all_levels', 'beginner', 'intermediate', 'advanced']);
export const GAME_STATUSES = Object.freeze(['scheduled', 'canceled']);
