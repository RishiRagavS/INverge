// Local end-to-end test: runs the real Worker against an in-memory SQLite (D1 shim).
// Run: node test/e2e.mjs
import assert from 'node:assert/strict';
import { makeDB } from './d1shim.mjs';
import worker from '../src/index.js';
import { dbh, refreshTrust } from '../src/lib.js';

import { readFileSync } from 'node:fs';
const DEMO_PW = process.env.DEMO_PASSWORD || readFileSync(new URL('../demo-password.txt', import.meta.url), 'utf8').trim();
const DB = makeDB(['schema.sql', 'seed.sql']);
const env = { DB, ADMIN_EMAILS: 'admin@test.dev', ALLOW_DEMO_ADMIN: 'true', PBKDF2_ITERATIONS: '1000' };

function client() {
  let cookie = '';
  const call = async (method, path, body, opts = {}) => {
    const headers = { 'content-type': opts.contentType || 'application/json', origin: 'http://localhost' };
    if (cookie) headers.cookie = cookie;
    const res = await worker.fetch(new Request('http://localhost' + path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env);
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : null, res };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), put: (p, b) => call('PUT', p, b ?? {}), del: (p) => call('DELETE', p), call };
}
let passed = 0;
const ok = (name, fn) => fn().then(() => { passed++; console.log('  ✓', name); }).catch((e) => { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; });

const pngB64 = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(3000, 7)]).toString('base64');
const pdfB64 = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3000, 65)]).toString('base64');
const exeB64 = Buffer.alloc(3000, 1).toString('base64');

console.log('Seed consistency');
await ok('seeded trust levels match the trust engine', async () => {
  const db = dbh(DB);
  for (const u of await db.all('SELECT id, name, trust_level FROM users')) {
    const lvl = await refreshTrust(db, u.id);
    assert.equal(lvl, u.trust_level, `${u.name}: seeded ${u.trust_level}, computed ${lvl}`);
  }
});

console.log('Auth');
const A = client();
let otp;
await ok('CSRF: non-JSON POST rejected', async () => assert.equal((await A.call('POST', '/api/auth/login', 'a=b', { contentType: 'text/plain' })).status, 415));
await ok('register validates password', async () => assert.equal((await A.post('/api/auth/register', { accept_terms: true, role: 'founder', name: 'Test Founder', email: 'new@test.dev', password: 'short', country: 'India', city: 'Pune' })).status, 400));
await ok('register returns demo OTP when no email key', async () => {
  const r = await A.post('/api/auth/register', { accept_terms: true, role: 'founder', name: 'Test Founder', email: 'new@test.dev', password: 'Passw0rd!x', country: 'India', city: 'Pune' });
  assert.equal(r.status, 200); assert.match(r.body.demo_otp, /^\d{6}$/); otp = r.body.demo_otp;
});
await ok('cannot access app before OTP', async () => assert.equal((await A.get('/api/me')).body.user, null));
await ok('wrong OTP rejected, right OTP logs in', async () => {
  assert.equal((await A.post('/api/auth/verify-otp', { email: 'new@test.dev', code: '000000' })).status, 400);
  const r = await A.post('/api/auth/verify-otp', { email: 'new@test.dev', code: otp });
  assert.equal(r.status, 200); assert.equal(r.body.user.trust, 0); assert.equal(r.body.user.role, 'founder');
});
await ok('login with wrong password fails; right works', async () => {
  const B = client();
  assert.equal((await B.post('/api/auth/login', { email: 'new@test.dev', password: 'nope' })).status, 401);
  assert.equal((await B.post('/api/auth/login', { email: 'new@test.dev', password: 'Passw0rd!x' })).status, 200);
});
await ok('password reset flow', async () => {
  const B = client();
  const f = await B.post('/api/auth/forgot', { email: 'new@test.dev' });
  const r = await B.post('/api/auth/reset', { email: 'new@test.dev', code: f.body.demo_otp, password: 'Passw0rd!y' });
  assert.equal(r.status, 200);
  assert.equal((await B.post('/api/auth/login', { email: 'new@test.dev', password: 'Passw0rd!y' })).status, 200);
  assert.equal((await A.get('/api/me')).body.user, null, 'old sessions revoked');
  const L = await A.post('/api/auth/login', { email: 'new@test.dev', password: 'Passw0rd!y' });
  assert.equal(L.status, 200);
});

console.log('Unverified = browse only');
await ok('can browse discover & feed', async () => {
  assert.ok((await A.get('/api/users')).body.users.length > 5);
  assert.ok((await A.get('/api/feed')).body.posts.length > 5);
});
await ok('cannot message, connect, post, book', async () => {
  assert.equal((await A.post('/api/messages', { to_id: 5, body: 'hello there' })).status, 403);
  assert.equal((await A.post('/api/connections', { to_id: 5 })).status, 403);
  assert.equal((await A.post('/api/posts', { body: 'my first post' })).status, 403);
  assert.equal((await A.post('/api/bookings', { slot_id: 1, topic: 'Anything useful' })).status, 403);
});

console.log('Profile + verification');
await ok('profile update validates LinkedIn host', async () => {
  assert.equal((await A.put('/api/me', { linkedin_url: 'https://evil.com/in/x' })).status, 400);
  const r = await A.put('/api/me', { linkedin_url: 'linkedin.com/in/test-founder', headline: 'Building X', bio: 'Founder building a thing worth building for many people.', startup_name: 'Acme', stages: ['Seed'], funding_goal: 1000000, industries: ['Fintech', 'Bogus'] });
  assert.equal(r.status, 200); assert.deepEqual(r.body.user.industries, ['Fintech']);
});
await ok('rejects fake / wrong-type uploads', async () => {
  assert.equal((await A.post('/api/me/documents', { kind: 'gov_id', name: 'id.pdf', data: exeB64 })).status, 400);
  assert.equal((await A.post('/api/me/documents', { kind: 'investment_proof', name: 'a.pdf', data: pdfB64 })).status, 400);
  assert.equal((await A.post('/api/me/documents', { kind: 'pitch_deck', name: 'a.png', data: pngB64 })).status, 400);
});
await ok('gov ID + LinkedIn auto-check → Basic badge', async () => {
  const r = await A.post('/api/me/documents', { kind: 'gov_id', name: 'passport.png', data: pngB64 });
  assert.equal(r.status, 200); assert.equal(r.body.trust, 1);
  assert.equal((await A.get('/api/me')).body.user.trust_label, 'Basic');
});
await ok('now can post, comment, connect, message', async () => {
  const p = await A.post('/api/posts', { type: 'update', body: 'Excited to join INverge — building Acme.' });
  assert.equal(p.status, 200);
  assert.equal((await A.post('/api/posts', { type: 'call', body: 'investor-only type' })).status, 403);
  assert.equal((await A.post(`/api/posts/${p.body.post.id}/comments`, { body: 'First!' })).status, 200);
  assert.equal((await A.post('/api/connections', { to_id: 5 })).body.status, 'sent');
  assert.equal((await A.post('/api/connections', { to_id: 5 })).status, 409);
  assert.equal((await A.post('/api/connections', { to_id: 13 })).status, 400); // unverified recipient
  const m = await A.post('/api/messages', { to_id: 5, kind: 'pitch', body: 'We are building Acme, raising a $1M seed round to scale.' });
  assert.equal(m.status, 200);
});
await ok('attachments need valid files and are access-controlled', async () => {
  const f = await A.post('/api/files', { kind: 'attachment', name: 'deck.pdf', data: pdfB64 });
  assert.equal(f.status, 200);
  assert.equal((await A.post('/api/messages', { to_id: 5, body: 'Deck attached', file_id: f.body.id })).status, 200);
  const P = client(); await P.post('/api/auth/login', { email: 'alpha.investor@inverge.test', password: DEMO_PW });
  assert.equal((await P.call('GET', '/api/files/' + f.body.id)).status, 200, 'recipient can open');
  const J = client(); await J.post('/api/auth/login', { email: 'bravo.investor@inverge.test', password: DEMO_PW });
  assert.equal((await J.call('GET', '/api/files/' + f.body.id)).status, 403, 'third party blocked');
  const doc = (await A.get('/api/me/documents')).body.documents[0];
  assert.equal((await J.call('GET', '/api/files/' + doc.file_id)).status, 403, 'ID doc private');
});

console.log('Admin review → Gold');
await ok('admin disabled without email provider unless explicitly allowed', async () => { const { isAdminEmail } = await import('../src/lib.js'); assert.equal(isAdminEmail({ ADMIN_EMAILS: 'a@b.c' }, 'a@b.c'), false); assert.equal(isAdminEmail({ ADMIN_EMAILS: 'a@b.c', RESEND_API_KEY: 'k' }, 'A@b.c'), true); });
await ok('non-admin blocked from admin endpoints', async () => assert.equal((await A.get('/api/admin/documents')).status, 403));
const ADM = client();
await ok('admin approves ID + registration → Gold', async () => {
  // admin account = a normal verified account whose email is in ADMIN_EMAILS
  const r = await ADM.post('/api/auth/register', { accept_terms: true, role: 'mentor', name: 'Admin User', email: 'admin@test.dev', password: 'Passw0rd!a', country: 'India', city: 'Delhi' });
  await ADM.post('/api/auth/verify-otp', { email: 'admin@test.dev', code: r.body.demo_otp });
  assert.equal((await ADM.get('/api/me')).body.user.is_admin, true);
  const reg = await A.post('/api/me/documents', { kind: 'registration', name: 'reg.pdf', data: pdfB64 });
  assert.equal(reg.status, 200);
  const list = (await ADM.get('/api/admin/documents?status=pending')).body.documents.filter((d) => d.user_name === 'Test Founder');
  assert.equal(list.length, 2);
  assert.equal((await ADM.post(`/api/admin/documents/${list[0].id}/review`, { status: 'rejected' })).status, 400, 'reject needs reason');
  for (const d of list) assert.equal((await ADM.post(`/api/admin/documents/${d.id}/review`, { status: 'approved' })).status, 200);
  assert.equal((await A.get('/api/me')).body.user.trust_label, 'Gold');
  const v = (await A.get('/api/me/verification')).body;
  assert.equal(v.level, 2);
  assert.ok((await A.get('/api/notifications')).body.notifications.some((n) => n.type === 'verification'));
});

console.log('Network, alignment, messaging');
const P = client();
await ok('seed member logs in; sees request; accepts', async () => {
  const l = await P.post('/api/auth/login', { email: 'alpha.investor@inverge.test', password: DEMO_PW });
  assert.equal(l.status, 200); assert.equal(l.body.user.trust, 3);
  const rec = await P.get('/api/network?tab=received');
  const mine = rec.body.users.find((u) => u.name === 'Test Founder');
  assert.ok(mine); assert.equal(mine.relation.status, 'received');
  assert.equal((await P.post(`/api/connections/${mine.relation.id}/accept`)).status, 200);
  assert.equal((await A.get('/api/network?tab=connected')).body.users.some((u) => u.id === 5), true);
});
await ok('messages thread, read receipts, conversations list', async () => {
  const t = await P.get(`/api/messages/${(await A.get('/api/me')).body.user.id}`);
  assert.equal(t.body.messages.length, 2); assert.equal(t.body.can_message, true);
  const mine = await A.get('/api/messages/5');
  assert.ok(mine.body.messages.every((m) => !m.mine || m.read), 'read receipts set');
  const conv = await P.get('/api/conversations');
  assert.ok(conv.body.conversations.length >= 2);
});
await ok('meeting request validates time', async () => {
  assert.equal((await A.post('/api/messages', { to_id: 5, kind: 'meeting', body: '', meta: { when: Date.now() - 1000 } })).status, 400);
  assert.equal((await A.post('/api/messages', { to_id: 5, kind: 'meeting', body: '', meta: { when: Date.now() + 86400000 } })).status, 200);
});
await ok('alignment returns scored matches with reasons; skip hides', async () => {
  const r = await A.get('/api/alignment');
  assert.ok(r.body.matches.length > 0);
  const top = r.body.matches[0];
  assert.ok(top.score > 0 && top.why.length >= 0);
  assert.ok(r.body.matches.every((m) => m.role !== 'founder'), 'founder gets investors+mentors');
  await A.post(`/api/alignment/${top.id}/skip`);
  assert.ok(!(await A.get('/api/alignment')).body.matches.some((m) => m.id === top.id));
});
await ok('discover filters work', async () => {
  const r = await A.get('/api/users?role=investor&industry=Fintech&trust=2');
  assert.ok(r.body.users.length > 0 && r.body.users.every((u) => u.role === 'investor' && u.trust >= 2));
  assert.equal((await A.get('/api/search?q=Alpha Investor')).body.users[0].name, 'Alpha Investor');
});
await ok('public profile, view tracking, analytics', async () => {
  const p = await A.get('/api/users/9');
  assert.equal(p.body.profile.role, 'mentor'); assert.ok(p.body.profile.rating.n >= 3); assert.ok(p.body.reviews.length);
  const R = client(); await R.post('/api/auth/login', { email: 'alpha.mentor@inverge.test', password: DEMO_PW });
  const an = await R.get('/api/me/analytics'); assert.ok(an.body.views_14d.length === 14);
  assert.equal((await A.get('/api/users/9')).status, 200); // same day: no double count
});

console.log('Feed');
await ok('react / save / share / hot flag / filters / delete', async () => {
  const f = (await A.get('/api/feed')).body;
  const post = f.posts.find((p) => !p.liked);
  assert.equal((await A.post(`/api/posts/${post.id}/react`)).body.liked, true);
  assert.equal((await A.post(`/api/posts/${post.id}/react`)).body.liked, false);
  assert.equal((await A.post(`/api/posts/${post.id}/save`)).body.saved, true);
  assert.ok((await A.get('/api/feed?filter=saved')).body.posts.some((p) => p.id === post.id));
  assert.ok(f.posts.some((p) => p.hot));
  assert.ok((await A.get('/api/feed?filter=funding')).body.posts.every((p) => p.type === 'funding'));
  const mine = (await A.get('/api/feed?filter=network')).body.posts.find((p) => p.mine);
  assert.equal((await P.del(`/api/posts/${mine.id}`)).status, 403);
  assert.equal((await A.del(`/api/posts/${mine.id}`)).status, 200);
});

console.log('Mentor room');
await ok('book slot, double-book blocked, cancel reopens, mentor completes, mentee reviews', async () => {
  const slots = (await A.get('/api/mentors/9/slots')).body.slots; assert.ok(slots.length);
  const b = await A.post('/api/bookings', { slot_id: slots[0].id, topic: 'Seed narrative review' });
  assert.equal(b.status, 200);
  assert.equal((await P.post('/api/bookings', { slot_id: slots[0].id, topic: 'Competing booking' })).status, 409);
  assert.equal((await A.post(`/api/bookings/${b.body.id}/cancel`)).status, 200);
  assert.ok((await A.get('/api/mentors/9/slots')).body.slots.some((s) => s.id === slots[0].id), 'slot reopened');
  assert.equal((await A.post('/api/bookings', { slot_id: slots[0].id, topic: 'Rebooking now' })).status, 200);
  const R = client(); await R.post('/api/auth/login', { email: 'alpha.mentor@inverge.test', password: DEMO_PW });
  const bk = (await R.get('/api/bookings')).body.bookings.find((x) => x.status === 'confirmed' && x.other.name === 'Test Founder');
  assert.equal((await R.post(`/api/bookings/${bk.id}/complete`)).status, 400, 'future session cannot complete');
  assert.equal((await P.post('/api/bookings', { slot_id: slots[1].id, topic: 'Investor booking' })).status, 200, 'investors may book too');
});
await ok('mentor publishes slots; mentors cannot book', async () => {
  const R = client(); await R.post('/api/auth/login', { email: 'bravo.mentor@inverge.test', password: DEMO_PW });
  assert.equal((await R.post('/api/me/slots', { starts_at: Date.now() + 10 * 86400000, duration_min: 45 })).status, 200);
  assert.equal((await A.post('/api/me/slots', { starts_at: Date.now() + 10 * 86400000 })).status, 403);
  assert.equal((await R.post('/api/bookings', { slot_id: 1, topic: 'mentors cannot do this' })).status, 403);
});
await ok('Q&A: ask, only mentors answer', async () => {
  const q = await A.post('/api/questions', { title: 'How do I price a B2B pilot?', body: 'We have 3 pilots.', tag: 'Sales' });
  assert.equal(q.status, 200);
  assert.equal((await A.post(`/api/questions/${q.body.id}/answers`, { body: 'Founders cannot answer here.' })).status, 403);
  const R = client(); await R.post('/api/auth/login', { email: 'bravo.mentor@inverge.test', password: DEMO_PW });
  assert.equal((await R.post(`/api/questions/${q.body.id}/answers`, { body: 'Charge for pilots — even a small fee filters tyre-kickers.' })).status, 200);
  assert.equal((await A.get(`/api/questions/${q.body.id}`)).body.answers.length, 1);
});
await ok('learning hub: list, read, submit', async () => {
  const l = (await A.get('/api/resources')).body.resources; assert.ok(l.length >= 7);
  const g = l.find((x) => x.has_body);
  assert.ok((await A.get(`/api/resources/${g.id}`)).body.resource.body.length > 50);
  assert.equal((await A.post('/api/resources', { type: 'video', title: 'A great talk', url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await A.post('/api/resources', { type: 'video', title: 'A great talk', url: 'https://example.com/v' })).status, 200);
});
await ok('notifications list + mark read; counts', async () => {
  const c = (await P.get('/api/counts')).body; assert.ok(c.notifications > 0);
  await P.post('/api/notifications/read');
  assert.equal((await P.get('/api/counts')).body.notifications, 0);
});
await ok('logout invalidates session', async () => {
  await A.post('/api/auth/logout');
  assert.equal((await A.get('/api/me')).body.user, null);
  assert.equal((await A.get('/api/feed')).status, 401);
});
await ok('unknown route → 404 JSON', async () => assert.equal((await A.get('/api/nope')).status, 404));

console.log(`\n${passed} checks passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
