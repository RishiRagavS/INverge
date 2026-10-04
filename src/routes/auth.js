import { bad, HttpError, str, isEmail, hashPassword, verifyPassword, randomCode, randomToken, sha256, sendEmail, otpEmail, ROLES, refreshTrust } from '../lib.js';
import { buildMe } from './profile.js';

const OTP_TTL = 10 * 60_000;
const SESSION_TTL = 30 * 24 * 3600_000;
const iters = (env) => Number(env.PBKDF2_ITERATIONS) || 15000;
const DUMMY = 'pbkdf2$15000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function issueOtp(ctx, email, purpose) {
  const { db, env } = ctx;
  const last = await db.one('SELECT created_at FROM otps WHERE email=? AND purpose=? ORDER BY id DESC LIMIT 1', email, purpose);
  if (last && Date.now() - last.created_at < 30_000) throw new HttpError(429, 'Please wait 30 seconds before requesting another code.');
  const code = randomCode();
  await db.run('DELETE FROM otps WHERE email=? AND purpose=?', email, purpose);
  await db.run('INSERT INTO otps (email,purpose,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,0,?)', email, purpose, await sha256(`${code}:${email.toLowerCase()}`), Date.now() + OTP_TTL, Date.now());
  const r = await sendEmail(env, { to: email, ...otpEmail(code, purpose) });
  // Demo mode: no email provider configured, so the code is returned to the UI. Never happens once RESEND_API_KEY is set.
  return r.demo ? { demo_otp: code } : {};
}

async function checkOtp(db, email, purpose, code) {
  const row = await db.one('SELECT * FROM otps WHERE email=? AND purpose=? ORDER BY id DESC LIMIT 1', email, purpose);
  if (!row || row.expires_at < Date.now()) throw bad('That code has expired. Request a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many attempts. Request a new code.');
  if ((await sha256(`${String(code).trim()}:${email.toLowerCase()}`)) !== row.code_hash) {
    await db.run('UPDATE otps SET attempts = attempts + 1 WHERE id=?', row.id);
    throw bad('Incorrect code. Please check and try again.');
  }
  await db.run('DELETE FROM otps WHERE email=? AND purpose=?', email, purpose);
}

async function startSession(ctx, userId) {
  const token = randomToken();
  await ctx.db.run('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)', await sha256(token), userId, Date.now() + SESSION_TTL, Date.now());
  ctx.setCookie(token, SESSION_TTL / 1000);
}

const checkPassword = (p) => {
  if (typeof p !== 'string' || p.length < 10 || p.length > 128 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw bad('Password must be 10+ characters and include a letter and a number.');
  return p;
};

export default (r) => {
  r.post('/api/auth/register', async (ctx) => {
    const b = await ctx.body();
    const role = String(b.role);
    if (!ROLES.includes(role)) throw bad('Choose a role: founder, investor or mentor.');
    const name = str(b.name, { min: 2, max: 80, name: 'Name' });
    const email = str(b.email, { max: 254, name: 'Email' }).toLowerCase();
    if (!isEmail(email)) throw bad('Enter a valid email address.');
    if (!(b.accept_terms === true || b.accept_terms === 'on' || b.accept_terms === 'true')) throw bad('Please accept the Terms of Use and Privacy Notice to create an account.');
    const password = checkPassword(b.password);
    const country = str(b.country, { min: 2, max: 60, name: 'Country' });
    const city = str(b.city, { min: 2, max: 60, name: 'City' });
    const hash = await hashPassword(password, iters(ctx.env));

    const existing = await ctx.db.one('SELECT id, email_verified FROM users WHERE email=?', email);
    if (existing?.email_verified) throw new HttpError(409, 'An account with this email already exists. Try logging in.');
    if (existing) await ctx.db.run('UPDATE users SET role=?, name=?, password_hash=?, country=?, city=? WHERE id=?', role, name, hash, country, city, existing.id);
    else await ctx.db.run('INSERT INTO users (email,password_hash,role,name,country,city,created_at) VALUES (?,?,?,?,?,?,?)', email, hash, role, name, country, city, Date.now());
    return { ok: true, email, ...(await issueOtp(ctx, email, 'signup')) };
  }, true);

  r.post('/api/auth/resend-otp', async (ctx) => {
    const b = await ctx.body();
    const email = String(b.email || '').toLowerCase();
    const u = await ctx.db.one('SELECT id, email_verified FROM users WHERE email=?', email);
    if (!u || u.email_verified) return { ok: true }; // do not leak account existence
    return { ok: true, ...(await issueOtp(ctx, email, 'signup')) };
  }, true);

  r.post('/api/auth/verify-otp', async (ctx) => {
    const b = await ctx.body();
    const email = String(b.email || '').toLowerCase();
    const u = await ctx.db.one('SELECT * FROM users WHERE email=?', email);
    if (!u) throw bad('Incorrect code. Please check and try again.');
    await checkOtp(ctx.db, email, 'signup', b.code);
    await ctx.db.run('UPDATE users SET email_verified=1 WHERE id=?', u.id);
    await refreshTrust(ctx.db, u.id);
    await startSession(ctx, u.id);
    return { user: await buildMe(ctx, await ctx.db.one('SELECT * FROM users WHERE id=?', u.id)) };
  }, true);

  r.post('/api/auth/login', async (ctx) => {
    const b = await ctx.body();
    const email = String(b.email || '').trim().toLowerCase();
    const u = await ctx.db.one('SELECT * FROM users WHERE email=?', email);
    const ok = await verifyPassword(String(b.password || ''), u ? u.password_hash : DUMMY);
    if (!u || !ok) throw new HttpError(401, 'Incorrect email or password.');
    if (!u.email_verified) {
      const extra = await issueOtp(ctx, email, 'signup').catch(() => ({}));
      throw new HttpError(403, 'Please verify your email to continue.', { needs_verification: true, email, ...extra });
    }
    await startSession(ctx, u.id);
    return { user: await buildMe(ctx, u) };
  }, true);

  r.post('/api/auth/logout', async (ctx) => {
    const m = /inv_session=([^;]+)/.exec(ctx.req.headers.get('cookie') || '');
    if (m) await ctx.db.run('DELETE FROM sessions WHERE token_hash=?', await sha256(m[1]));
    ctx.setCookie('', 0);
    return { ok: true };
  }, true);

  r.post('/api/auth/forgot', async (ctx) => {
    const b = await ctx.body();
    const email = String(b.email || '').trim().toLowerCase();
    const u = await ctx.db.one('SELECT id FROM users WHERE email=? AND email_verified=1', email);
    return { ok: true, email, ...(u ? await issueOtp(ctx, email, 'reset') : {}) };
  }, true);

  r.post('/api/auth/reset', async (ctx) => {
    const b = await ctx.body();
    const email = String(b.email || '').trim().toLowerCase();
    const password = checkPassword(b.password);
    const u = await ctx.db.one('SELECT id FROM users WHERE email=? AND email_verified=1', email);
    if (!u) throw bad('Incorrect code. Please check and try again.');
    await checkOtp(ctx.db, email, 'reset', b.code);
    await ctx.db.run('UPDATE users SET password_hash=? WHERE id=?', await hashPassword(password, iters(ctx.env)), u.id);
    await ctx.db.run('DELETE FROM sessions WHERE user_id=?', u.id);
    return { ok: true };
  }, true);
};
