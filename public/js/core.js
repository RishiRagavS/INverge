// INverge frontend core: safe templating, API client, icons, UI helpers.
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const str = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(str).join('') : esc(v));
// Tagged template: every interpolation is HTML-escaped unless it is a Raw (another html`` result).
export const html = (s, ...v) => new Raw(s.reduce((a, p, i) => a + p + (i < v.length ? str(v[i]) : ''), ''));

// ---------- state ----------
export const state = { me: null, meta: null };
export const actions = {}, forms = {}, inputs = {};

// ---------- API ----------
export async function api(method, path, body) {
  let res;
  try {
    res = await fetch('/api' + path, { method, credentials: 'same-origin', headers: body !== undefined || method !== 'GET' ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined });
  } catch { throw new Error('Network error. Check your connection and try again.'); }
  let data = null; try { data = await res.json(); } catch { /* no body */ }
  if (res.status === 401 && state.me) { state.me = null; location.hash = '#/login'; }
  if (!res.ok) { const e = new Error(data?.error || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e; }
  return data;
}
api.get = (p) => api('GET', p); api.post = (p, b) => api('POST', p, b ?? {}); api.put = (p, b) => api('PUT', p, b ?? {}); api.del = (p) => api('DELETE', p);
export const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v !== '' && v != null && p.set(k, v)); const s = p.toString(); return s ? '?' + s : ''; };

// ---------- icons ----------
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>', book: '<path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M8 8h6"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bell: '<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 8H4c0-1 2-2 2-8z"/><path d="M10 20a2 2 0 004 0"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="M12 20V6M6 12l6-6 6 6"/>', comment: '<path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z"/>',
  share: '<path d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>', check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', cal: '<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>', link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', send: '<path d="M3 11l18-8-8 18-2-8z"/>', clip: '<path d="M20 11l-8 8a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', logout: '<path d="M9 4H4v16h5M16 8l4 4-4 4M20 12H9"/>', star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  lock: '<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 018 0v3"/>', back: '<path d="M15 6l-6 6 6 6"/>', dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
export const icon = (n, cls = '') => raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`);

// ---------- formatting ----------
export const ago = (t) => {
  const s = Math.max(1, (Date.now() - t) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago'; return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
export const when = (t) => new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const usd = (n) => (n == null || n === '' ? '—' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + n);
export const bytes = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
export const nl = (s) => raw(esc(s).replace(/\n/g, '<br>'));
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- identity widgets ----------
export const avatar = (u, size = '') => u.avatar
  ? raw(`<img class="avatar ${size}" alt="" src="/api/files/${esc(u.avatar)}" loading="lazy">`)
  : raw(`<div class="avatar ${size}" style="background:hsl(${170 + ((u.id * 17) % 30)},${35 + ((u.id * 7) % 25)}%,${78 - ((u.id * 5) % 12)}%)">${esc(u.name.split(' ').filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</div>`);
export const trustBadge = (lvl, label) => html`<span class="trust t${lvl}">${icon('shield')}${['Unverified', 'Basic', 'Gold', 'Elite'][lvl] || label}</span>`;
export const roleTag = (r) => html`<span class="role">${r}</span>`;
export const chips = (arr, cls = '') => html`<div class="chips">${(arr || []).map((c) => html`<span class="chip ${cls}">${c}</span>`)}</div>`;
export const stars = (n) => raw(`<span class="stars" aria-label="${n} of 5">${'★'.repeat(Math.round(n))}<span class="off">${'★'.repeat(5 - Math.round(n))}</span></span>`);
export const meter = (pct, n = 10) => raw(`<div class="meter" role="progressbar" aria-valuenow="${pct}">${Array.from({ length: n }, (_, i) => `<i class="${i < Math.round((pct / 100) * n) ? 'on' : ''}"></i>`).join('')}</div>`);
export const location_ = (u) => [u.city, u.country].filter(Boolean).join(', ');

// ---------- UI feedback ----------
export function toast(msg, bad = false) {
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg;
  document.getElementById('toasts').append(el); setTimeout(() => el.remove(), bad ? 5200 : 3200);
}
export function openModal(content) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="back" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true"><button class="btn ghost sm x" data-act="close-modal" aria-label="Close">${icon('x')}</button>${str(content)}</div></div>`;
  root.querySelector('input,textarea,select')?.focus();
}
export const closeModal = () => { document.getElementById('modal-root').innerHTML = ''; };
actions['close-modal'] = closeModal;
actions['modal-bg'] = (el, e) => { if (e.target === el) closeModal(); };
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

export async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.t = btn.innerHTML; }
  try { return await fn(); } catch (e) { toast(e.message, true); throw e; } finally { if (btn?.isConnected) { btn.disabled = false; btn.innerHTML = btn.dataset.t; } }
}
export const safe = (fn) => (...a) => Promise.resolve(fn(...a)).catch(() => {}); // errors already toasted by busy()

// Delegated events: data-act, form[data-form], [data-input]
document.addEventListener('click', (e) => { let el = e.target.closest('[data-act]'); if (el?.dataset.act === 'modal-bg' && e.target !== el) el = null; /* clicks inside the dialog must keep their default (form submit) */ if (el && actions[el.dataset.act]) { if (el.tagName !== 'INPUT') e.preventDefault(); safe(actions[el.dataset.act])(el, e); } });
document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-form]'); if (f) { e.preventDefault(); if (forms[f.dataset.form]) safe(forms[f.dataset.form])(f, e); } });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && inputs[el.dataset.change]) inputs[el.dataset.change](el, e); });

export const formData = (f) => { const o = {}; new FormData(f).forEach((v, k) => { if (k in o) o[k] = [].concat(o[k], v); else o[k] = v; }); return o; };
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- files ----------
const readB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function drawToJpeg(file, max, quality, square) {
  const bmp = await createImageBitmap(file);
  let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const k = Math.min(1, max / Math.max(sw, sh)), c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
}
// Prepares a File for upload: shrinks images to fit the ~1MB limit; other types must already fit.
export async function prepareFile(file, { avatar = false } = {}) {
  if (!file) throw new Error('Choose a file first.');
  if (avatar) { if (!file.type.startsWith('image/')) throw new Error('Please choose an image.'); return { name: 'avatar.jpg', data: await readB64(await drawToJpeg(file, 256, 0.85, true)) }; }
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    let max = 2000, q = 0.85, blob = file;
    if (file.size > 900_000 || file.type !== 'image/jpeg') for (let i = 0; i < 4; i++) { blob = await drawToJpeg(file, max, q); if (blob.size <= 950_000) break; max *= 0.75; q -= 0.1; }
    if (blob.size > 1_050_000) throw new Error('Image is still too large after compression. Try a smaller photo.');
    return { name: file.name.replace(/\.\w+$/, '') + '.jpg', data: await readB64(blob) };
  }
  if (file.size > 1_050_000) throw new Error('File is too large (limit about 1 MB). Compress it and try again.');
  return { name: file.name, data: await readB64(file) };
}
