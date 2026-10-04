// INverge shared helpers: errors, router, crypto, email, validation, trust engine.

export const INDUSTRIES = ['AI / ML', 'Fintech', 'HealthTech', 'EdTech', 'SaaS', 'Climate / CleanTech', 'E-commerce', 'AgriTech', 'DeepTech', 'Consumer', 'Web3', 'Mobility', 'Hardware / IoT', 'Media', 'Other'];
export const STAGES = ['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B+'];
export const EXPERTISE = ['Tech', 'Finance', 'Strategy', 'Marketing', 'Product', 'Sales', 'Legal', 'Fundraising', 'Operations', 'Talent / HR'];
export const INVESTOR_TYPES = ['Angel Investor', 'Angel Group', 'Venture Capitalist', 'Seed / Early-Stage Investor'];
export const ROLES = ['founder', 'investor', 'mentor'];
export const POST_TYPES = ['update', 'funding', 'call', 'insight', 'learning'];
export const DOC_KINDS = {
  gov_id: { label: 'Government ID', roles: ROLES, mimes: ['image', 'pdf'] },
  registration: { label: 'Business registration proof', roles: ['founder'], mimes: ['image', 'pdf'] },
  pitch_deck: { label: 'Pitch deck', roles: ['founder'], mimes: ['pdf', 'pptx'] },
  investment_proof: { label: 'Investment license / proof', roles: ['investor'], mimes: ['image', 'pdf'] },
  portfolio: { label: 'Portfolio proof', roles: ['investor'], mimes: ['image', 'pdf'] },
  resume: { label: 'Resume / experience proof', roles: ['mentor'], mimes: ['pdf', 'docx'] },
  certification: { label: 'Certification', roles: ['mentor'], mimes: ['image', 'pdf'] },
};
// Admin = verified email listed in ADMIN_EMAILS. Safety: without a real email provider (RESEND_API_KEY) anyone could "verify"
// any address via the on-screen demo OTP, so admin rights are disabled unless ALLOW_DEMO_ADMIN=true (local development only).
export const isAdminEmail = (env, email) => {
  if (!env.RESEND_API_KEY && env.ALLOW_DEMO_ADMIN !== 'true') return false;
  return (env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(String(email).toLowerCase());
};
export const TRUST = ['Unverified', 'Basic', 'Gold', 'Elite'];
export const MAX_FILE_B64 = 1_500_000; // ~1.1MB raw, keeps a D1 row under the 2MB limit
export const ELITE_MIN_CONNECTIONS = 3;
export const ELITE_MIN_ACTIVITY = 5;

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (m, extra) => new HttpError(400, m, extra);
export const forbidden = (m) => new HttpError(403, m);
export const notFound = (m = 'Not found') => new HttpError(404, m);

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });

// ---------- Router ----------
export class Router {
  constructor() { this.routes = []; }
  add(method, path, handler, pub = false) {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:([a-z_]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler, pub });
  }
  get(p, h, pub) { this.add('GET', p, h, pub); }
  post(p, h, pub) { this.add('POST', p, h, pub); }
  put(p, h, pub) { this.add('PUT', p, h, pub); }
  del(p, h, pub) { this.add('DELETE', p, h, pub); }
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(pathname);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { route: r, params };
      }
    }
    return null;
  }
}

// ---------- DB helpers (D1 API) ----------
export const dbh = (db) => ({
  one: (sql, ...a) => db.prepare(sql).bind(...a).first(),
  all: async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results || [],
  run: (sql, ...a) => db.prepare(sql).bind(...a).run(),
  raw: db,
});

// ---------- Crypto ----------
const enc = new TextEncoder();
export const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
export const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const unb64url = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return unb64(s); };
export const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async (s) => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}
// Format: pbkdf2$<iterations>$<salt>$<hash>. Iterations are stored per-hash so you can raise them later.
export async function hashPassword(password, iterations = 15000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(await pbkdf2(password, salt, iterations))}`;
}
export async function verifyPassword(password, stored) {
  const [alg, it, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  const got = b64url(await pbkdf2(password, unb64url(salt), Number(it)));
  if (got.length !== hash.length) return false;
  let diff = 0; for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

// ---------- Email (Resend) ----------
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) return { sent: false, demo: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'INverge <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail);
    throw new HttpError(502, 'Could not send the verification email. If you are using the Resend sandbox sender (onboarding@resend.dev) it can only deliver to your own Resend account email — verify a domain in Resend to email anyone.');
  }
  return { sent: true };
}
export const otpEmail = (code, purpose) => ({
  subject: `${code} is your INverge ${purpose === 'reset' ? 'password reset' : 'verification'} code`,
  text: `Your INverge code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
  html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:2px solid #0b1b1c"><p style="font:700 12px monospace;letter-spacing:.12em;color:#0e7c7b">INVERGE // ${purpose === 'reset' ? 'PASSWORD RESET' : 'VERIFICATION'}</p><h1 style="font-size:40px;letter-spacing:.2em;margin:12px 0">${code}</h1><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
});

// ---------- Validation ----------
export const str = (v, { min = 0, max = 500, name = 'Field' } = {}) => {
  const s = String(v ?? '').trim();
  if (s.length < min) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} is too long (max ${max})`);
  return s;
};
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
export const cleanUrl = (u, { host } = {}) => {
  const s = String(u || '').trim();
  if (!s) return '';
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { throw bad('Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw bad('Invalid URL');
  if (host && !host.test(url.hostname)) throw bad('Please enter a valid ' + host.source.replace(/[\\^$()|]/g, '').replace('.*', '') + ' link');
  return url.toString().slice(0, 300);
};
export const list = (v, allowed, max = 8) => {
  const arr = (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  return [...new Set(arr.filter((x) => !allowed || allowed.includes(x)))].slice(0, max).join(',');
};
export const csv = (s) => (s ? String(s).split(',').filter(Boolean) : []);
export const intOrNull = (v, { min = 0, max = 1e12 } = {}) => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw bad('Invalid number');
  return n;
};

// Quick "auto-check" of uploads: sniff the real file type from magic bytes.
export function sniff(b64data) {
  let head;
  try { head = unb64(b64data.slice(0, 24)); } catch { return null; }
  const hex = [...head.slice(0, 12)].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('25504446')) return { type: 'pdf', mime: 'application/pdf' };
  if (hex.startsWith('89504e47')) return { type: 'image', mime: 'image/png' };
  if (hex.startsWith('ffd8ff')) return { type: 'image', mime: 'image/jpeg' };
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return { type: 'image', mime: 'image/webp' };
  if (hex.startsWith('504b0304')) return { type: 'zip', mime: 'application/zip' }; // docx / pptx
  return null;
}

// ---------- Relations & trust ----------
export const pad = (n) => String(n).padStart(4, '0');
export const codeFor = (role, id) => ({ founder: 'FND', investor: 'INV', mentor: 'MNT' }[role] + '-' + pad(id));

export async function connectionState(db, me, otherId) {
  const row = await db.one('SELECT * FROM connections WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)', me, otherId, otherId, me);
  if (!row) return { status: 'none' };
  if (row.status === 'accepted') return { status: 'connected', id: row.id };
  if (row.status === 'pending') return { status: row.requester_id === me ? 'sent' : 'received', id: row.id };
  return { status: row.requester_id === me ? 'declined' : 'none', id: row.id };
}

// Recompute and persist a user's trust level. Returns the new level.
export async function refreshTrust(db, userId) {
  const u = await db.one('SELECT * FROM users WHERE id=?', userId);
  if (!u) return 0;
  const docs = await db.all('SELECT kind, status FROM documents WHERE user_id=?', userId);
  const has = (k, st) => docs.some((d) => d.kind === k && (st ? d.status === st : d.status !== 'rejected'));
  let level = 0;
  const basic = u.email_verified && has('gov_id') && /linkedin\.com/i.test(u.linkedin_url || '');
  if (basic) level = 1;
  const proofKinds = { founder: ['registration', 'pitch_deck'], investor: ['investment_proof'], mentor: ['resume'] }[u.role];
  if (level >= 1 && has('gov_id', 'approved') && proofKinds.some((k) => has(k, 'approved'))) level = 2;
  if (level === 2) {
    const [c, a] = await Promise.all([
      db.one("SELECT COUNT(*) n FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)", userId, userId),
      db.one('SELECT (SELECT COUNT(*) FROM posts WHERE user_id=?) + (SELECT COUNT(*) FROM comments WHERE user_id=?) + (SELECT COUNT(*) FROM answers WHERE user_id=?) n', userId, userId, userId),
    ]);
    if (c.n >= ELITE_MIN_CONNECTIONS && a.n >= ELITE_MIN_ACTIVITY) level = 3;
  }
  if (level !== u.trust_level) {
    await db.run('UPDATE users SET trust_level=? WHERE id=?', level, userId);
    if (level > u.trust_level) await notify(db, userId, 'verification', null, `Your trust badge is now ${TRUST[level]}.`, '#/verification');
  }
  return level;
}

const NOTIF_PREF = { connection_request: 'requests', connection_accepted: 'requests', message: 'messages', booking: 'bookings' };
export async function notify(db, userId, type, actorId, text, link) {
  const pref = NOTIF_PREF[type];
  if (pref) {
    const row = await db.one('SELECT notif_prefs FROM users WHERE id=?', userId);
    try { if (JSON.parse(row?.notif_prefs || '{}')[pref] === false) return; } catch { /* default: notify */ }
  }
  await db.run('INSERT INTO notifications (user_id,type,actor_id,text,link,read,created_at) VALUES (?,?,?,?,?,0,?)', userId, type, actorId, text, link || null, Date.now());
}

export function requireVerified(user, what = 'do this') {
  if (user.trust_level < 1) throw forbidden(`Verify your identity to ${what}. Unverified accounts are browse-only.`);
}

// Public, shareable shape of a user.
export const publicUser = (u) => ({
  id: u.id, code: codeFor(u.role, u.id), role: u.role, name: u.name, headline: u.headline, country: u.country, city: u.city,
  avatar: u.avatar_file_id || null, trust: u.trust_level, trust_label: TRUST[u.trust_level],
  startup_name: u.startup_name, industries: csv(u.industries), stages: csv(u.stages), expertise: csv(u.expertise), investor_type: u.investor_type,
});

export function completeness(u, docs) {
  const checks = [
    ['Profile photo', !!u.avatar_file_id], ['Headline', !!u.headline], ['Bio', (u.bio || '').length >= 30],
    ['Location', !!(u.country && u.city)], ['LinkedIn', !!u.linkedin_url], ['Industries', !!u.industries],
    ['Government ID', docs.some((d) => d.kind === 'gov_id')],
  ];
  if (u.role === 'founder') checks.push(['Startup name', !!u.startup_name], ['Stage', !!u.stages], ['Funding goal', !!u.funding_goal]);
  if (u.role === 'investor') checks.push(['Investor type', !!u.investor_type], ['Ticket range', !!(u.ticket_min || u.ticket_max)]);
  if (u.role === 'mentor') checks.push(['Expertise', !!u.expertise], ['Experience', !!u.years_exp]);
  const done = checks.filter((c) => c[1]).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
}

// ---------- Alignment engine (transparent, rule-based) ----------
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach((x) => B.has(x) && i++); return i / (A.size + B.size - i); };
const fmtUsd = (n) => (n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + n);

export function alignmentScore(me, o) {
  let score = 0; const why = [];
  const sharedInd = csv(me.industries).filter((x) => csv(o.industries).includes(x));
  const ind = jaccard(csv(me.industries), csv(o.industries));
  score += Math.round(ind * 100 * 0.35);
  if (sharedInd.length) why.push(`Shared focus: ${sharedInd.slice(0, 3).join(', ')}`);

  const [f, i] = me.role === 'founder' ? [me, o] : o.role === 'founder' ? [o, me] : [null, null];
  if (f && i && i.role === 'investor') {
    if (csv(i.stages).includes(f.stages)) { score += 25; why.push(`Invests at ${f.stages} stage`); }
    if (f.funding_goal && (i.ticket_min || i.ticket_max)) {
      const lo = i.ticket_min || 0, hi = i.ticket_max || Infinity;
      if (f.funding_goal >= lo * 0.5 && f.funding_goal <= hi * 3) { score += 20; why.push(`Raise of ${fmtUsd(f.funding_goal)} fits their ${fmtUsd(lo)}–${hi === Infinity ? '+' : fmtUsd(hi)} ticket range`); }
    }
  } else if (f && i && i.role === 'mentor') {
    if (csv(i.stages).includes(f.stages)) { score += 20; why.push(`Mentors ${f.stages}-stage startups`); }
    if (i.years_exp >= 8) { score += 10; why.push(`${i.years_exp}+ years of experience`); }
    if (csv(i.expertise).length) { score += 10; why.push(`Expertise: ${csv(i.expertise).slice(0, 3).join(', ')}`); }
  } else if (me.role === 'investor' && o.role === 'mentor') {
    score += 15; if (csv(o.expertise).length) why.push(`Expertise: ${csv(o.expertise).slice(0, 3).join(', ')}`);
  }
  if (me.country && me.country === o.country) { score += 10; why.push(`Both based in ${o.country}`); }
  score += Math.round((o.trust_level / 3) * 10);
  if (o.trust_level >= 2) why.push(`${TRUST[o.trust_level]} verified`);
  return { score: Math.min(99, Math.max(5, score)), why: why.slice(0, 4) };
}
