// Navigation helpers shared by main.js and the views (kept separate to avoid circular imports).
import { state, api, toast } from './core.js';
let leave = [];
export const onLeave = (fn) => leave.push(fn);
export const runLeave = () => { leave.forEach((f) => { try { f(); } catch { /* ignore */ } }); leave = []; };
export const go = (h) => { if (location.hash === '#' + h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; };
export async function refreshMe() { try { state.me = (await api.get('/me')).user || null; } catch { state.me = null; } updateBadges(); return state.me; }
export function updateBadges() {
  const u = state.me?.unread || { notifications: 0, messages: 0 };
  document.querySelectorAll('[data-badge="notif"]').forEach((e) => { e.textContent = u.notifications; e.classList.toggle('hide', !u.notifications); });
  document.querySelectorAll('[data-badge="msg"]').forEach((e) => { e.textContent = u.messages; e.classList.toggle('hide', !u.messages); });
}
// Browse-only gate for the UI (the server enforces this too).
export function needVerified(what = 'do this') {
  if (state.me.trust >= 1) return true;
  toast(`Verify your identity to ${what}. Unverified accounts are browse-only.`, true);
  return false;
}
