// INverge — Cloudflare Worker entry. Zero runtime dependencies.
import { Router, HttpError, json, dbh, sha256, isAdminEmail } from './lib.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import socialRoutes from './routes/social.js';
import mentorshipRoutes from './routes/mentorship.js';

const router = new Router();
router.get('/api/health', () => ({ ok: true, app: 'INverge' }), true);
[authRoutes, profileRoutes, socialRoutes, mentorshipRoutes].forEach((mod) => mod(router));

const COOKIE = 'inv_session';
const readCookie = (req, name) => (req.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];

async function handle(req, env, url) {
  const m = router.match(req.method, url.pathname);
  if (!m) throw new HttpError(404, 'Not found');
  const db = dbh(env.DB);

  // CSRF defence: mutating requests must be JSON (not sendable by cross-site forms) and same-origin.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!(req.headers.get('content-type') || '').includes('application/json')) throw new HttpError(415, 'JSON required');
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'Cross-origin request blocked');
  }

  const ctx = {
    req, env, url, db, params: m.params, user: null, cookies: [],
    query: Object.fromEntries(url.searchParams),
    async body() { try { return (await req.json()) || {}; } catch { throw new HttpError(400, 'Invalid JSON body'); } },
    setCookie(value, maxAge) {
      this.cookies.push(`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`);
    },
  };

  const token = readCookie(req, COOKIE);
  if (token) {
    const row = await db.one(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
      await sha256(token), Date.now()
    );
    if (row) {
      ctx.user = { ...row, is_admin: isAdminEmail(env, row.email) && !!row.email_verified };
      if (!row.last_seen || Date.now() - row.last_seen > 600_000) await db.run('UPDATE users SET last_seen=? WHERE id=?', Date.now(), row.id);
    }
  }
  if (!m.route.pub && !ctx.user) throw new HttpError(401, 'Please log in');

  const out = await m.route.handler(ctx);
  const res = out instanceof Response ? out : json(out ?? { ok: true });
  ctx.cookies.forEach((c) => res.headers.append('set-cookie', c));
  return res;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    try {
      return await handle(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
      console.error('Unhandled', e?.stack || e);
      return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
    }
  },
};
