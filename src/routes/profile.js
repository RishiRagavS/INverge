import {
  bad, forbidden, notFound, HttpError, str, cleanUrl, list, csv, intOrNull, sniff, unb64, randomToken,
  INDUSTRIES, STAGES, EXPERTISE, INVESTOR_TYPES, DOC_KINDS, TRUST, MAX_FILE_B64, ELITE_MIN_CONNECTIONS, ELITE_MIN_ACTIVITY,
  publicUser, completeness, connectionState, refreshTrust, notify, requireVerified, alignmentScore, codeFor, isAdminEmail, b64,
} from '../lib.js';

// ---------- shapes ----------
export async function buildMe(ctx, u) {
  const { db, env } = ctx;
  const docs = await db.all('SELECT id, kind, status, note, is_public, created_at FROM documents WHERE user_id=?', u.id);
  const [n, m] = await Promise.all([
    db.one('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', u.id),
    db.one('SELECT COUNT(*) n FROM messages WHERE recipient_id=? AND read_at IS NULL', u.id),
  ]);
  let prefs = {}; try { prefs = JSON.parse(u.notif_prefs || '{}'); } catch { /* ignore */ }
  return {
    ...publicUser(u), email: u.email, email_verified: !!u.email_verified, onboarding_step: u.onboarding_step,
    bio: u.bio, linkedin_url: u.linkedin_url, website: u.website, funding_goal: u.funding_goal, traction: u.traction,
    ticket_min: u.ticket_min, ticket_max: u.ticket_max, portfolio: u.portfolio, years_exp: u.years_exp,
    notif_prefs: { requests: true, alignments: true, messages: true, bookings: true, ...prefs },
    completeness: completeness(u, docs), is_admin: u.is_admin ?? isAdminEmail(env, u.email),
    unread: { notifications: n.n, messages: m.n },
  };
}

// Adds relation + saved flag to a list of user rows.
export async function decorate(ctx, rows, extra = () => ({})) {
  if (!rows.length) return [];
  const me = ctx.user.id, ids = rows.map((r) => r.id), ph = ids.map(() => '?').join(',');
  const [conns, saved] = await Promise.all([
    ctx.db.all(`SELECT * FROM connections WHERE (requester_id=? AND addressee_id IN (${ph})) OR (addressee_id=? AND requester_id IN (${ph}))`, me, ...ids, me, ...ids),
    ctx.db.all(`SELECT saved_id FROM saved_profiles WHERE user_id=? AND saved_id IN (${ph})`, me, ...ids),
  ]);
  const savedSet = new Set(saved.map((s) => s.saved_id));
  return rows.map((r) => {
    const c = conns.find((x) => x.requester_id === r.id || x.addressee_id === r.id);
    let relation = { status: 'none' };
    if (c) relation = c.status === 'accepted' ? { status: 'connected', id: c.id } : c.status === 'pending' ? { status: c.requester_id === me ? 'sent' : 'received', id: c.id } : { status: 'none' };
    return { ...publicUser(r), snippet: (r.bio || '').slice(0, 140), relation, saved: savedSet.has(r.id), ...extra(r) };
  });
}

// ---------- uploads ----------
const rawSize = (s) => Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
const cleanName = (n) => String(n || 'file').split(/[\\/]/).pop().replace(/[^\w.\- ()]/g, '_').slice(0, 100) || 'file';
const OFFICE = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

function validateUpload(b, allowed) {
  const data = String(b.data || '').replace(/^data:[^,]*,/, '');
  if (!data) throw bad('No file received.');
  if (data.length > MAX_FILE_B64) throw bad('File is too large. The limit is about 1 MB — compress it and try again.');
  const kind = sniff(data);
  if (!kind) throw bad('Unsupported or unrecognised file type.');
  const name = cleanName(b.name);
  const ext = (name.split('.').pop() || '').toLowerCase();
  let mime = kind.mime;
  if (kind.type === 'zip') {
    if (!OFFICE[ext]) throw bad('Unsupported file type.');
    mime = OFFICE[ext];
    kind.type = ext;
  }
  if (!allowed.includes(kind.type)) throw bad(`This document must be: ${allowed.join(', ').toUpperCase()}.`);
  if (rawSize(data) < 1000) throw bad('That file looks empty or corrupt.');
  return { data, name, mime, size: rawSize(data) };
}

async function storeFile(ctx, kind, up) {
  const id = randomToken(12);
  await ctx.db.run('INSERT INTO files (id,owner_id,kind,name,mime,size,data,created_at) VALUES (?,?,?,?,?,?,?,?)', id, ctx.user.id, kind, up.name, up.mime, up.size, up.data, Date.now());
  return id;
}

async function dropDocument(ctx, doc) {
  await ctx.db.run('DELETE FROM documents WHERE id=?', doc.id);
  await ctx.db.run('DELETE FROM files WHERE id=? AND owner_id=?', doc.file_id, doc.user_id);
}

const requireAdmin = (ctx) => { if (!ctx.user.is_admin) throw forbidden('Admins only.'); };

// ---------- routes ----------
export default (r) => {
  r.get('/api/meta', () => ({ industries: INDUSTRIES, stages: STAGES, expertise: EXPERTISE, investor_types: INVESTOR_TYPES, doc_kinds: DOC_KINDS, trust: TRUST, elite: { connections: ELITE_MIN_CONNECTIONS, activity: ELITE_MIN_ACTIVITY } }), true);

  r.get('/api/me', async (ctx) => ({ user: ctx.user ? await buildMe(ctx, ctx.user) : null }), true); // public: anonymous visitors get { user: null }

  r.put('/api/me', async (ctx) => {
    const b = await ctx.body(), u = ctx.user, f = {};
    const has = (k) => k in b;
    if (has('name')) f.name = str(b.name, { min: 2, max: 80, name: 'Name' });
    if (has('headline')) f.headline = str(b.headline, { max: 120 });
    if (has('bio')) f.bio = str(b.bio, { max: 1200 });
    if (has('country')) f.country = str(b.country, { min: 2, max: 60, name: 'Country' });
    if (has('city')) f.city = str(b.city, { min: 2, max: 60, name: 'City' });
    if (has('linkedin_url')) f.linkedin_url = cleanUrl(b.linkedin_url, { host: /(^|\.)linkedin\.com$/i });
    if (has('website')) f.website = cleanUrl(b.website);
    if (has('industries')) f.industries = list(b.industries, INDUSTRIES);
    if (has('notif_prefs')) f.notif_prefs = JSON.stringify(Object.fromEntries(['requests', 'alignments', 'messages', 'bookings'].map((k) => [k, !!b.notif_prefs?.[k]])));
    if (has('avatar_file_id')) {
      const file = await ctx.db.one("SELECT id FROM files WHERE id=? AND owner_id=? AND kind='avatar'", b.avatar_file_id, u.id);
      if (!file) throw bad('Avatar not found.');
      f.avatar_file_id = file.id;
    }
    if (u.role === 'founder') {
      if (has('startup_name')) f.startup_name = str(b.startup_name, { max: 80 });
      if (has('stages')) { const s = list(b.stages, STAGES, 1); f.stages = s; }
      if (has('funding_goal')) f.funding_goal = intOrNull(b.funding_goal, { max: 1e10 });
      if (has('traction')) f.traction = str(b.traction, { max: 500 });
    }
    if (u.role === 'investor') {
      if (has('investor_type')) { if (b.investor_type && !INVESTOR_TYPES.includes(b.investor_type)) throw bad('Invalid investor type.'); f.investor_type = b.investor_type || null; }
      if (has('stages')) f.stages = list(b.stages, STAGES, 5);
      const lo = has('ticket_min') ? intOrNull(b.ticket_min, { max: 1e10 }) : u.ticket_min, hi = has('ticket_max') ? intOrNull(b.ticket_max, { max: 1e10 }) : u.ticket_max;
      if (lo != null && hi != null && lo > hi) throw bad('Minimum ticket cannot exceed maximum.');
      if (has('ticket_min')) f.ticket_min = lo;
      if (has('ticket_max')) f.ticket_max = hi;
      if (has('portfolio')) f.portfolio = str(b.portfolio, { max: 800 });
    }
    if (u.role === 'mentor') {
      if (has('expertise')) f.expertise = list(b.expertise, EXPERTISE, 6);
      if (has('stages')) f.stages = list(b.stages, STAGES, 5);
      if (has('years_exp')) f.years_exp = intOrNull(b.years_exp, { max: 60 });
    }
    const keys = Object.keys(f);
    if (keys.length) await ctx.db.run(`UPDATE users SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`, ...keys.map((k) => f[k]), u.id);
    await refreshTrust(ctx.db, u.id);
    return { user: await buildMe(ctx, await ctx.db.one('SELECT * FROM users WHERE id=?', u.id)) };
  });

  r.put('/api/me/onboarding', async (ctx) => {
    const b = await ctx.body();
    const step = Math.min(6, Math.max(3, Number(b.step) || 3));
    await ctx.db.run('UPDATE users SET onboarding_step=? WHERE id=?', step, ctx.user.id);
    return { ok: true };
  });

  // ----- files -----
  r.post('/api/files', async (ctx) => {
    const b = await ctx.body();
    if (b.kind === 'avatar') {
      const up = validateUpload(b, ['image']);
      if (up.data.length > 400_000) throw bad('Profile photo is too large.');
      return { id: await storeFile(ctx, 'avatar', up), name: up.name };
    }
    if (b.kind === 'attachment') {
      requireVerified(ctx.user, 'share files');
      const up = validateUpload(b, ['pdf', 'image', 'pptx', 'docx']);
      return { id: await storeFile(ctx, 'attachment', up), name: up.name, size: up.size };
    }
    throw bad('Unknown upload kind.');
  });

  r.get('/api/files/:id', async (ctx) => {
    const f = await ctx.db.one('SELECT * FROM files WHERE id=?', ctx.params.id);
    if (!f) throw notFound();
    const me = ctx.user;
    let ok = f.owner_id === me.id || me.is_admin || f.kind === 'avatar';
    if (!ok && f.kind === 'attachment') ok = !!(await ctx.db.one('SELECT id FROM messages WHERE file_id=? AND (sender_id=? OR recipient_id=?)', f.id, me.id, me.id));
    if (!ok && f.kind === 'doc') ok = me.trust_level >= 1 && !!(await ctx.db.one("SELECT id FROM documents WHERE file_id=? AND kind='pitch_deck' AND is_public=1", f.id));
    if (!ok) throw forbidden('You do not have access to this file.');
    const bytes = unb64(f.data);
    const inline = f.mime.startsWith('image/') || f.mime === 'application/pdf';
    return new Response(bytes, {
      headers: {
        'content-type': f.mime, 'content-length': String(bytes.length), 'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/"/g, '')}"`,
        'cache-control': f.kind === 'avatar' ? 'private, max-age=86400' : 'private, no-store',
      },
    });
  });

  // ----- documents & verification -----
  r.get('/api/me/documents', async (ctx) => ({
    documents: await ctx.db.all('SELECT d.id, d.kind, d.status, d.note, d.is_public, d.created_at, d.file_id, f.name, f.size FROM documents d JOIN files f ON f.id=d.file_id WHERE d.user_id=? ORDER BY d.id DESC', ctx.user.id),
  }));

  r.post('/api/me/documents', async (ctx) => {
    const b = await ctx.body(), u = ctx.user;
    const spec = DOC_KINDS[b.kind];
    if (!spec || !spec.roles.includes(u.role)) throw bad('That document type is not available for your role.');
    const up = validateUpload(b, spec.mimes.flatMap((m) => (m === 'image' ? ['image'] : [m])));
    if (b.kind !== 'certification') {
      for (const d of await ctx.db.all('SELECT * FROM documents WHERE user_id=? AND kind=?', u.id, b.kind)) await dropDocument(ctx, d);
    } else if ((await ctx.db.one("SELECT COUNT(*) n FROM documents WHERE user_id=? AND kind='certification'", u.id)).n >= 3) throw bad('You can upload up to 3 certifications.');
    const fileId = await storeFile(ctx, 'doc', up);
    const res = await ctx.db.run('INSERT INTO documents (user_id,kind,file_id,status,is_public,created_at) VALUES (?,?,?,?,?,?)', u.id, b.kind, fileId, 'pending', b.kind === 'pitch_deck' && b.is_public ? 1 : 0, Date.now());
    const level = await refreshTrust(ctx.db, u.id);
    return { id: res.meta.last_row_id, trust: level };
  });

  r.put('/api/me/documents/:id', async (ctx) => { // toggle deck visibility
    const b = await ctx.body();
    await ctx.db.run("UPDATE documents SET is_public=? WHERE id=? AND user_id=? AND kind='pitch_deck'", b.is_public ? 1 : 0, ctx.params.id, ctx.user.id);
    return { ok: true };
  });

  r.del('/api/me/documents/:id', async (ctx) => {
    const d = await ctx.db.one('SELECT * FROM documents WHERE id=? AND user_id=?', ctx.params.id, ctx.user.id);
    if (!d) throw notFound();
    await dropDocument(ctx, d);
    return { ok: true, trust: await refreshTrust(ctx.db, ctx.user.id) };
  });

  r.get('/api/me/verification', async (ctx) => {
    const u = ctx.user, db = ctx.db;
    await refreshTrust(db, u.id);
    const fresh = await db.one('SELECT * FROM users WHERE id=?', u.id);
    const docs = await db.all('SELECT kind, status, note FROM documents WHERE user_id=?', u.id);
    const d = (k) => docs.find((x) => x.kind === k);
    const docItem = (k, label, hint) => { const x = d(k); return { key: k, label, hint, done: !!x && x.status !== 'rejected', status: x ? x.status : 'missing', note: x?.note || null }; };
    const [c, a] = await Promise.all([
      db.one("SELECT COUNT(*) n FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)", u.id, u.id),
      db.one('SELECT (SELECT COUNT(*) FROM posts WHERE user_id=?) + (SELECT COUNT(*) FROM comments WHERE user_id=?) + (SELECT COUNT(*) FROM answers WHERE user_id=?) n', u.id, u.id, u.id),
    ]);
    const proof = { founder: ['registration', 'Business registration proof (or approved pitch deck)', 'Optional for early-stage founders, but one approved proof is needed for Gold.'], investor: ['investment_proof', 'Investment license or proof of past deals', 'Needed for Gold.'], mentor: ['resume', 'Resume / experience proof', 'Needed for Gold.'] }[u.role];
    const gold2 = u.role === 'founder' ? docs.some((x) => ['registration', 'pitch_deck'].includes(x.kind) && x.status === 'approved') : d(proof[0])?.status === 'approved';
    const tiers = [
      { level: 1, name: 'Basic', blurb: 'Identity verified — unlocks messaging, connecting, pitching and booking.', items: [
        { key: 'email', label: 'Email verified with one-time code', done: !!fresh.email_verified, status: fresh.email_verified ? 'approved' : 'missing' },
        docItem('gov_id', 'Government ID uploaded', 'Passport, driver’s licence, national ID (Aadhaar for India). JPG, PNG or PDF, under 1 MB.'),
        { key: 'linkedin', label: 'LinkedIn profile linked', done: /linkedin\.com/i.test(fresh.linkedin_url || ''), status: /linkedin\.com/i.test(fresh.linkedin_url || '') ? 'approved' : 'missing', hint: 'Add it on your profile page.' },
      ] },
      { level: 2, name: 'Gold', blurb: 'Documents reviewed and approved by the INverge team.', items: [
        { key: 'gov_id_ok', label: 'Government ID approved', done: d('gov_id')?.status === 'approved', status: d('gov_id')?.status === 'approved' ? 'approved' : 'pending' },
        { key: 'proof_ok', label: proof[1] + ' approved', done: gold2, status: gold2 ? 'approved' : 'pending', hint: proof[2] },
      ] },
      { level: 3, name: 'Elite', blurb: 'Earned through community trust and consistent activity.', items: [
        { key: 'conns', label: `${ELITE_MIN_CONNECTIONS}+ accepted connections`, done: c.n >= ELITE_MIN_CONNECTIONS, status: c.n >= ELITE_MIN_CONNECTIONS ? 'approved' : 'pending', progress: `${Math.min(c.n, ELITE_MIN_CONNECTIONS)}/${ELITE_MIN_CONNECTIONS}` },
        { key: 'activity', label: `${ELITE_MIN_ACTIVITY}+ posts, comments or answers`, done: a.n >= ELITE_MIN_ACTIVITY, status: a.n >= ELITE_MIN_ACTIVITY ? 'approved' : 'pending', progress: `${Math.min(a.n, ELITE_MIN_ACTIVITY)}/${ELITE_MIN_ACTIVITY}` },
      ] },
    ];
    const optional = { founder: [docItem('pitch_deck', 'Pitch deck (shareable with verified investors)'), docItem('registration', 'Business registration proof')], investor: [docItem('portfolio', 'Portfolio proof')], mentor: [docItem('certification', 'Certification')] }[u.role];
    return { level: fresh.trust_level, label: TRUST[fresh.trust_level], tiers, optional };
  });

  r.get('/api/me/analytics', async (ctx) => {
    const id = ctx.user.id, db = ctx.db, day = (ms) => new Date(ms).toISOString().slice(0, 10);
    const since = day(Date.now() - 13 * 86400000);
    const [series, v30, saved, reacts, posts, conns, pending] = await Promise.all([
      db.all('SELECT day, COUNT(*) n FROM profile_views WHERE profile_id=? AND day>=? GROUP BY day', id, since),
      db.one('SELECT COUNT(*) n FROM profile_views WHERE profile_id=? AND day>=?', id, day(Date.now() - 29 * 86400000)),
      db.one('SELECT COUNT(*) n FROM saved_profiles WHERE saved_id=?', id),
      db.one('SELECT COUNT(*) n FROM post_reactions r JOIN posts p ON p.id=r.post_id WHERE p.user_id=?', id),
      db.one('SELECT COUNT(*) n FROM posts WHERE user_id=?', id),
      db.one("SELECT COUNT(*) n FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)", id, id),
      db.one("SELECT COUNT(*) n FROM connections WHERE status='pending' AND addressee_id=?", id),
    ]);
    const map = Object.fromEntries(series.map((s) => [s.day, s.n]));
    const days = Array.from({ length: 14 }, (_, i) => { const d = day(Date.now() - (13 - i) * 86400000); return { day: d, n: map[d] || 0 }; });
    return { views_14d: days, views_30d: v30.n, saved_by: saved.n, reactions: reacts.n, posts: posts.n, connections: conns.n, pending_requests: pending.n };
  });

  // ----- discovery -----
  r.get('/api/users', async (ctx) => {
    const q = ctx.query, where = ['u.email_verified=1', 'u.id<>?'], args = [ctx.user.id];
    if (['founder', 'investor', 'mentor'].includes(q.role)) { where.push('u.role=?'); args.push(q.role); }
    if (q.industry) { where.push("(',' || u.industries || ',') LIKE ?"); args.push(`%,${q.industry},%`); }
    if (q.stage) { where.push("(',' || u.stages || ',') LIKE ?"); args.push(`%,${q.stage},%`); }
    if (q.country) { where.push('u.country=?'); args.push(q.country); }
    if (q.trust && Number(q.trust) > 0) { where.push('u.trust_level>=?'); args.push(Math.min(3, Number(q.trust))); }
    if (q.q && q.q.trim().length >= 2) { where.push("(u.name LIKE ? OR u.headline LIKE ? OR u.startup_name LIKE ? OR u.city LIKE ?)"); const t = `%${q.q.trim()}%`; args.push(t, t, t, t); }
    const limit = 12, offset = Math.max(0, Number(q.offset) || 0);
    const rows = await ctx.db.all(`SELECT u.* FROM users u WHERE ${where.join(' AND ')} ORDER BY u.trust_level DESC, u.last_seen DESC, u.id DESC LIMIT ? OFFSET ?`, ...args, limit + 1, offset);
    const countries = await ctx.db.all("SELECT DISTINCT country FROM users WHERE email_verified=1 AND country IS NOT NULL ORDER BY country");
    return { users: await decorate(ctx, rows.slice(0, limit)), has_more: rows.length > limit, countries: countries.map((c) => c.country) };
  });

  r.get('/api/search', async (ctx) => {
    const t = String(ctx.query.q || '').trim();
    if (t.length < 2) return { users: [] };
    const like = `%${t}%`;
    const rows = await ctx.db.all("SELECT * FROM users WHERE email_verified=1 AND (name LIKE ? OR startup_name LIKE ? OR headline LIKE ?) ORDER BY trust_level DESC LIMIT 7", like, like, like);
    return { users: rows.map(publicUser) };
  });

  r.get('/api/users/:id', async (ctx) => {
    const u = await ctx.db.one('SELECT * FROM users WHERE id=? AND email_verified=1', ctx.params.id);
    if (!u) throw notFound('Profile not found');
    const me = ctx.user, self = u.id === me.id;
    if (!self) await ctx.db.run('INSERT OR IGNORE INTO profile_views (viewer_id, profile_id, day) VALUES (?,?,?)', me.id, u.id, new Date().toISOString().slice(0, 10));
    const [deco] = await decorate(ctx, [u]);
    const [stats, posts, deck, rating, reviews, slots] = await Promise.all([
      ctx.db.one("SELECT (SELECT COUNT(*) FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)) c, (SELECT COUNT(*) FROM posts WHERE user_id=?) p", u.id, u.id, u.id),
      ctx.db.all('SELECT id, type, body, created_at, (SELECT COUNT(*) FROM post_reactions WHERE post_id=posts.id) likes, (SELECT COUNT(*) FROM comments WHERE post_id=posts.id) comments FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 5', u.id),
      u.role === 'founder' && me.trust_level >= 1 || self ? ctx.db.one("SELECT d.id, f.id file_id, f.name FROM documents d JOIN files f ON f.id=d.file_id WHERE d.user_id=? AND d.kind='pitch_deck' AND (d.is_public=1 OR ?=1)", u.id, self ? 1 : 0) : null,
      u.role === 'mentor' ? ctx.db.one('SELECT AVG(rating) avg, COUNT(*) n FROM reviews WHERE mentor_id=?', u.id) : null,
      u.role === 'mentor' ? ctx.db.all('SELECT r.rating, r.body, r.created_at, us.name reviewer FROM reviews r JOIN users us ON us.id=r.reviewer_id WHERE r.mentor_id=? ORDER BY r.id DESC LIMIT 5', u.id) : [],
      u.role === 'mentor' ? ctx.db.one("SELECT COUNT(*) n FROM mentor_slots WHERE mentor_id=? AND status='open' AND starts_at>?", u.id, Date.now()) : null,
    ]);
    return {
      profile: {
        ...deco, bio: u.bio, linkedin_url: u.linkedin_url, website: u.website, funding_goal: u.funding_goal, traction: u.traction,
        ticket_min: u.ticket_min, ticket_max: u.ticket_max, portfolio: u.portfolio, years_exp: u.years_exp, member_since: u.created_at,
        connections: stats.c, posts_count: stats.p, deck, rating: rating ? { avg: rating.avg ? Math.round(rating.avg * 10) / 10 : null, n: rating.n } : null,
        open_slots: slots?.n ?? null, self,
      },
      posts, reviews,
    };
  });

  r.post('/api/users/:id/save', async (ctx) => {
    const id = Number(ctx.params.id);
    if (id === ctx.user.id) throw bad('You cannot save yourself.');
    if (!(await ctx.db.one('SELECT id FROM users WHERE id=?', id))) throw notFound();
    await ctx.db.run('INSERT OR IGNORE INTO saved_profiles (user_id, saved_id, created_at) VALUES (?,?,?)', ctx.user.id, id, Date.now());
    return { ok: true };
  });
  r.del('/api/users/:id/save', async (ctx) => { await ctx.db.run('DELETE FROM saved_profiles WHERE user_id=? AND saved_id=?', ctx.user.id, ctx.params.id); return { ok: true }; });

  // ----- alignment -----
  r.get('/api/alignment', async (ctx) => {
    const me = ctx.user;
    const targets = { founder: ['investor', 'mentor'], investor: ['founder', 'mentor'], mentor: ['founder', 'investor'] }[me.role];
    const rows = await ctx.db.all(
      `SELECT * FROM users WHERE email_verified=1 AND id<>? AND role IN (?,?)
       AND id NOT IN (SELECT skipped_id FROM skips WHERE user_id=?)
       AND id NOT IN (SELECT CASE WHEN requester_id=? THEN addressee_id ELSE requester_id END FROM connections WHERE (requester_id=? OR addressee_id=?) AND status<>'declined')
       ORDER BY trust_level DESC LIMIT 300`, me.id, targets[0], targets[1], me.id, me.id, me.id, me.id);
    const scored = rows.map((o) => ({ o, ...alignmentScore(me, o) })).sort((a, b) => b.score - a.score).slice(0, 12);
    const map = new Map(scored.map((s) => [s.o.id, s]));
    const out = await decorate(ctx, scored.map((s) => s.o), (row) => ({ score: map.get(row.id).score, why: map.get(row.id).why }));
    return { matches: out.sort((a, b) => b.score - a.score) };
  });
  r.post('/api/alignment/:id/skip', async (ctx) => { await ctx.db.run('INSERT OR IGNORE INTO skips (user_id, skipped_id) VALUES (?,?)', ctx.user.id, ctx.params.id); return { ok: true }; });
  r.post('/api/alignment/reset', async (ctx) => { await ctx.db.run('DELETE FROM skips WHERE user_id=?', ctx.user.id); return { ok: true }; });

  // ----- network & connections -----
  r.get('/api/network', async (ctx) => {
    const me = ctx.user.id, tab = ctx.query.tab || 'connected';
    let rows;
    if (tab === 'saved') rows = await ctx.db.all('SELECT u.* FROM saved_profiles s JOIN users u ON u.id=s.saved_id WHERE s.user_id=? ORDER BY s.created_at DESC', me);
    else if (tab === 'sent') rows = await ctx.db.all("SELECT u.* FROM connections c JOIN users u ON u.id=c.addressee_id WHERE c.requester_id=? AND c.status='pending' ORDER BY c.id DESC", me);
    else if (tab === 'received') rows = await ctx.db.all("SELECT u.* FROM connections c JOIN users u ON u.id=c.requester_id WHERE c.addressee_id=? AND c.status='pending' ORDER BY c.id DESC", me);
    else rows = await ctx.db.all("SELECT u.* FROM connections c JOIN users u ON u.id = CASE WHEN c.requester_id=? THEN c.addressee_id ELSE c.requester_id END WHERE (c.requester_id=? OR c.addressee_id=?) AND c.status='accepted' ORDER BY c.id DESC", me, me, me);
    const counts = await ctx.db.one("SELECT (SELECT COUNT(*) FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)) connected, (SELECT COUNT(*) FROM connections WHERE status='pending' AND requester_id=?) sent, (SELECT COUNT(*) FROM connections WHERE status='pending' AND addressee_id=?) received, (SELECT COUNT(*) FROM saved_profiles WHERE user_id=?) saved", me, me, me, me, me);
    return { users: await decorate(ctx, rows), counts };
  });

  r.post('/api/connections', async (ctx) => {
    requireVerified(ctx.user, 'connect with others');
    const b = await ctx.body(), to = Number(b.to_id), me = ctx.user;
    if (!to || to === me.id) throw bad('Invalid member.');
    const other = await ctx.db.one('SELECT * FROM users WHERE id=? AND email_verified=1', to);
    if (!other) throw notFound('Member not found');
    if (other.trust_level < 1) throw bad('This member has not completed verification yet, so they cannot receive requests.');
    const st = await connectionState(ctx.db, me.id, to);
    if (st.status === 'connected') throw new HttpError(409, 'You are already connected.');
    if (st.status === 'sent') throw new HttpError(409, 'Request already sent.');
    if (st.status === 'received') { // they already asked us: accept
      await ctx.db.run("UPDATE connections SET status='accepted' WHERE id=?", st.id);
      await notify(ctx.db, to, 'connection_accepted', me.id, `${me.name} accepted your connection request.`, `#/profile/${me.id}`);
      await Promise.all([refreshTrust(ctx.db, me.id), refreshTrust(ctx.db, to)]);
      return { status: 'connected', id: st.id };
    }
    if (st.status === 'declined') throw new HttpError(409, 'This member declined your earlier request.');
    const old = await ctx.db.one('SELECT id FROM connections WHERE requester_id=? AND addressee_id=?', to, me.id); // they declined before; allow us to ask
    let cid = old?.id;
    if (old) await ctx.db.run("UPDATE connections SET requester_id=?, addressee_id=?, status='pending', created_at=? WHERE id=?", me.id, to, Date.now(), old.id);
    else cid = (await ctx.db.run('INSERT INTO connections (requester_id, addressee_id, status, created_at) VALUES (?,?,?,?)', me.id, to, 'pending', Date.now())).meta.last_row_id;
    await notify(ctx.db, to, 'connection_request', me.id, `${me.name} wants to connect with you.`, '#/network/received');
    return { status: 'sent', id: cid };
  });

  const respond = (status) => async (ctx) => {
    requireVerified(ctx.user, 'respond to requests');
    const c = await ctx.db.one("SELECT * FROM connections WHERE id=? AND addressee_id=? AND status='pending'", ctx.params.id, ctx.user.id);
    if (!c) throw notFound('Request not found');
    await ctx.db.run('UPDATE connections SET status=? WHERE id=?', status, c.id);
    if (status === 'accepted') {
      await notify(ctx.db, c.requester_id, 'connection_accepted', ctx.user.id, `${ctx.user.name} accepted your connection request.`, `#/profile/${ctx.user.id}`);
      await Promise.all([refreshTrust(ctx.db, c.requester_id), refreshTrust(ctx.db, ctx.user.id)]);
    }
    return { ok: true };
  };
  r.post('/api/connections/:id/accept', respond('accepted'));
  r.post('/api/connections/:id/decline', respond('declined'));
  r.del('/api/connections/:id', async (ctx) => {
    await ctx.db.run('DELETE FROM connections WHERE id=? AND (requester_id=? OR addressee_id=?)', ctx.params.id, ctx.user.id, ctx.user.id);
    return { ok: true };
  });

  // ----- admin: document review -----
  r.get('/api/admin/documents', async (ctx) => {
    requireAdmin(ctx);
    const st = ['pending', 'approved', 'rejected'].includes(ctx.query.status) ? ctx.query.status : 'pending';
    const rows = await ctx.db.all("SELECT d.id, d.kind, d.status, d.note, d.created_at, d.file_id, f.name, f.size, f.mime, u.id user_id, u.name user_name, u.role, u.country, u.linkedin_url FROM documents d JOIN files f ON f.id=d.file_id JOIN users u ON u.id=d.user_id WHERE d.status=? ORDER BY d.id ASC LIMIT 100", st);
    const stats = await ctx.db.one("SELECT (SELECT COUNT(*) FROM users WHERE email_verified=1) users, (SELECT COUNT(*) FROM documents WHERE status='pending') pending, (SELECT COUNT(*) FROM posts) posts, (SELECT COUNT(*) FROM messages) messages");
    return { documents: rows.map((d) => ({ ...d, label: DOC_KINDS[d.kind]?.label || d.kind, code: codeFor(d.role, d.user_id) })), stats };
  });
  r.post('/api/admin/documents/:id/review', async (ctx) => {
    requireAdmin(ctx);
    const b = await ctx.body();
    if (!['approved', 'rejected'].includes(b.status)) throw bad('Status must be approved or rejected.');
    const d = await ctx.db.one('SELECT * FROM documents WHERE id=?', ctx.params.id);
    if (!d) throw notFound();
    const note = str(b.note, { max: 300 }) || null;
    if (b.status === 'rejected' && !note) throw bad('Please add a short reason for the rejection.');
    await ctx.db.run('UPDATE documents SET status=?, note=?, reviewed_at=? WHERE id=?', b.status, note, Date.now(), d.id);
    await notify(ctx.db, d.user_id, 'verification', null, `Your ${DOC_KINDS[d.kind]?.label || 'document'} was ${b.status}${note ? ': ' + note : '.'}`, '#/verification');
    await refreshTrust(ctx.db, d.user_id);
    return { ok: true };
  });
};
