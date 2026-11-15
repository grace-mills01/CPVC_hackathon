// Hash the conversation ID for a varied color that stays stable across reloads.
const colors = ['coral', 'teal', 'gold', 'beige', 'grey', 'sage'];
export function conversationColor(id) {
 let hash = 2166136261;
 for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
 return colors[(hash >>> 0) % colors.length];
}
