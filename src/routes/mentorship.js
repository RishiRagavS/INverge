import { bad, forbidden, notFound, HttpError, str, cleanUrl, list, EXPERTISE, STAGES, publicUser, requireVerified, refreshTrust, notify, codeFor } from '../lib.js';
import { decorate } from './profile.js';

const DAY = 86400000;
const authorOf = (r) => ({ id: r.uid, code: codeFor(r.role, r.uid), role: r.role, name: r.name, headline: r.headline, avatar: r.avatar_file_id || null, trust: r.trust_level });
const requireMentor = (u) => { if (u.role !== 'mentor') throw forbidden('Only mentors can do this.'); };

export default (r) => {
  // ----- mentor directory -----
  r.get('/api/mentors', async (ctx) => {
    const q = ctx.query, where = ["u.role='mentor'", 'u.email_verified=1', 'u.id<>?'], args = [ctx.user.id];
    if (q.expertise) { where.push("(',' || u.expertise || ',') LIKE ?"); args.push(`%,${q.expertise},%`); }
    if (q.stage) { where.push("(',' || u.stages || ',') LIKE ?"); args.push(`%,${q.stage},%`); }
    if (q.trust && Number(q.trust) > 0) { where.push('u.trust_level>=?'); args.push(Number(q.trust)); }
    if (q.q && q.q.trim().length >= 2) { where.push('(u.name LIKE ? OR u.headline LIKE ? OR u.bio LIKE ?)'); const t = `%${q.q.trim()}%`; args.push(t, t, t); }
    const order = { experience: 'u.years_exp DESC', newest: 'u.id DESC' }[q.sort] || 'avg DESC, rn DESC, u.trust_level DESC';
    const now = Date.now();
    const rows = await ctx.db.all(
      `SELECT u.*, (SELECT AVG(rating) FROM reviews WHERE mentor_id=u.id) avg, (SELECT COUNT(*) FROM reviews WHERE mentor_id=u.id) rn,
        (SELECT COUNT(*) FROM mentor_slots WHERE mentor_id=u.id AND status='open' AND starts_at>?) open_slots,
        (SELECT MIN(starts_at) FROM mentor_slots WHERE mentor_id=u.id AND status='open' AND starts_at>?) next_slot
       FROM users u WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 40`, now, now, ...args);
    const byId = new Map(rows.map((x) => [x.id, x]));
    return { mentors: await decorate(ctx, rows, (row) => { const x = byId.get(row.id); return { years_exp: x.years_exp, rating: x.avg ? Math.round(x.avg * 10) / 10 : null, reviews: x.rn, open_slots: x.open_slots, next_slot: x.next_slot }; }) };
  });

  r.get('/api/mentors/:id/slots', async (ctx) => ({
    slots: await ctx.db.all("SELECT id, starts_at, duration_min FROM mentor_slots WHERE mentor_id=? AND status='open' AND starts_at>? ORDER BY starts_at LIMIT 30", ctx.params.id, Date.now()),
  }));

  // ----- mentor's own availability -----
  r.get('/api/me/slots', async (ctx) => {
    requireMentor(ctx.user);
    return { slots: await ctx.db.all('SELECT s.id, s.starts_at, s.duration_min, s.status, b.id booking_id, b.topic, u.name mentee FROM mentor_slots s LEFT JOIN bookings b ON b.slot_id=s.id LEFT JOIN users u ON u.id=b.mentee_id WHERE s.mentor_id=? AND s.starts_at>? ORDER BY s.starts_at LIMIT 60', ctx.user.id, Date.now() - DAY) };
  });
  r.post('/api/me/slots', async (ctx) => {
    requireMentor(ctx.user);
    requireVerified(ctx.user, 'publish availability');
    const b = await ctx.body();
    const starts = (Array.isArray(b.starts) ? b.starts : [b.starts_at]).map(Number).filter(Boolean).slice(0, 20);
    const dur = [15, 30, 45, 60].includes(Number(b.duration_min)) ? Number(b.duration_min) : 30;
    if (!starts.length) throw bad('Pick a date and time.');
    const open = (await ctx.db.one("SELECT COUNT(*) n FROM mentor_slots WHERE mentor_id=? AND status='open' AND starts_at>?", ctx.user.id, Date.now())).n;
    if (open + starts.length > 40) throw bad('You can have up to 40 open slots at a time.');
    for (const s of starts) {
      if (s < Date.now() + 5 * 60_000 || s > Date.now() + 90 * DAY) throw bad('Slots must be between now and 90 days ahead.');
      const clash = await ctx.db.one('SELECT id FROM mentor_slots WHERE mentor_id=? AND starts_at=?', ctx.user.id, s);
      if (!clash) await ctx.db.run('INSERT INTO mentor_slots (mentor_id,starts_at,duration_min) VALUES (?,?,?)', ctx.user.id, s, dur);
    }
    return { ok: true };
  });
  r.del('/api/me/slots/:id', async (ctx) => {
    requireMentor(ctx.user);
    const res = await ctx.db.run("DELETE FROM mentor_slots WHERE id=? AND mentor_id=? AND status='open'", ctx.params.id, ctx.user.id);
    if (!res.meta.changes) throw bad('Only open slots can be removed. Cancel the booking first.');
    return { ok: true };
  });

  // ----- bookings -----
  r.post('/api/bookings', async (ctx) => {
    const me = ctx.user;
    requireVerified(me, 'book a session');
    if (me.role === 'mentor') throw forbidden('Mentors cannot book sessions. Founders and investors can.');
    const b = await ctx.body();
    const slot = await ctx.db.one("SELECT * FROM mentor_slots WHERE id=? AND status='open' AND starts_at>?", b.slot_id, Date.now());
    if (!slot) throw new HttpError(409, 'That slot is no longer available.');
    const mentor = await ctx.db.one('SELECT * FROM users WHERE id=?', slot.mentor_id);
    if (mentor.trust_level < 1) throw bad('This mentor is not yet verified.');
    const topic = str(b.topic, { min: 5, max: 300, name: 'Topic' });
    const claim = await ctx.db.run("UPDATE mentor_slots SET status='booked' WHERE id=? AND status='open'", slot.id); // atomic claim
    if (!claim.meta.changes) throw new HttpError(409, 'That slot was just booked by someone else.');
    const res = await ctx.db.run("INSERT INTO bookings (slot_id,mentor_id,mentee_id,topic,status,created_at) VALUES (?,?,?,?, 'confirmed', ?)", slot.id, slot.mentor_id, me.id, topic, Date.now());
    await notify(ctx.db, slot.mentor_id, 'booking', me.id, `${me.name} booked a ${slot.duration_min}-minute session with you.`, '#/mentors/sessions');
    return { id: res.meta.last_row_id, starts_at: slot.starts_at };
  });

  r.get('/api/bookings', async (ctx) => {
    const me = ctx.user.id;
    const rows = await ctx.db.all(
      `SELECT b.id, b.status, b.topic, b.mentor_id, b.mentee_id, s.starts_at, s.duration_min,
         u.id oid, u.name oname, u.role orole, u.avatar_file_id oavatar, u.trust_level otrust, u.headline oheadline,
         (SELECT id FROM reviews WHERE booking_id=b.id) review_id
       FROM bookings b JOIN mentor_slots s ON s.id=b.slot_id JOIN users u ON u.id = CASE WHEN b.mentor_id=? THEN b.mentee_id ELSE b.mentor_id END
       WHERE b.mentor_id=? OR b.mentee_id=? ORDER BY s.starts_at DESC LIMIT 60`, me, me, me);
    return {
      bookings: rows.map((x) => ({
        id: x.id, status: x.status, topic: x.topic, starts_at: x.starts_at, duration: x.duration_min, as: x.mentor_id === me ? 'mentor' : 'mentee',
        other: { id: x.oid, name: x.oname, role: x.orole, avatar: x.oavatar || null, trust: x.otrust, headline: x.oheadline },
        reviewed: !!x.review_id,
      })),
    };
  });

  r.post('/api/bookings/:id/cancel', async (ctx) => {
    const bk = await ctx.db.one("SELECT b.*, s.starts_at FROM bookings b JOIN mentor_slots s ON s.id=b.slot_id WHERE b.id=? AND (b.mentor_id=? OR b.mentee_id=?) AND b.status='confirmed'", ctx.params.id, ctx.user.id, ctx.user.id);
    if (!bk) throw notFound('Booking not found');
    if (bk.starts_at < Date.now()) throw bad('This session has already started.');
    const byMentor = bk.mentor_id === ctx.user.id;
    await ctx.db.run('DELETE FROM bookings WHERE id=?', bk.id);
    if (byMentor) await ctx.db.run('DELETE FROM mentor_slots WHERE id=?', bk.slot_id);
    else await ctx.db.run("UPDATE mentor_slots SET status='open' WHERE id=?", bk.slot_id);
    await notify(ctx.db, byMentor ? bk.mentee_id : bk.mentor_id, 'booking', ctx.user.id, `${ctx.user.name} cancelled your upcoming session.`, '#/mentors/sessions');
    return { ok: true };
  });

  r.post('/api/bookings/:id/complete', async (ctx) => {
    requireMentor(ctx.user);
    const bk = await ctx.db.one("SELECT b.*, s.starts_at FROM bookings b JOIN mentor_slots s ON s.id=b.slot_id WHERE b.id=? AND b.mentor_id=? AND b.status='confirmed'", ctx.params.id, ctx.user.id);
    if (!bk) throw notFound('Booking not found');
    if (bk.starts_at > Date.now()) throw bad('You can mark a session complete once it has started.');
    await ctx.db.run("UPDATE bookings SET status='completed' WHERE id=?", bk.id);
    await notify(ctx.db, bk.mentee_id, 'booking', ctx.user.id, `Your session with ${ctx.user.name} is complete. Leave a review!`, '#/mentors/sessions');
    return { ok: true };
  });

  r.post('/api/bookings/:id/review', async (ctx) => {
    const b = await ctx.body();
    const bk = await ctx.db.one("SELECT * FROM bookings WHERE id=? AND mentee_id=? AND status='completed'", ctx.params.id, ctx.user.id);
    if (!bk) throw bad('You can review a session once the mentor has marked it complete.');
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) throw bad('Choose a rating from 1 to 5.');
    if (await ctx.db.one('SELECT id FROM reviews WHERE booking_id=?', bk.id)) throw new HttpError(409, 'You already reviewed this session.');
    await ctx.db.run('INSERT INTO reviews (booking_id,mentor_id,reviewer_id,rating,body,created_at) VALUES (?,?,?,?,?,?)', bk.id, bk.mentor_id, ctx.user.id, rating, str(b.body, { max: 500 }) || null, Date.now());
    await notify(ctx.db, bk.mentor_id, 'booking', ctx.user.id, `${ctx.user.name} left you a ${rating}-star review.`, `#/profile/${bk.mentor_id}`);
    return { ok: true };
  });

  // ----- public Q&A -----
  r.get('/api/questions', async (ctx) => {
    const where = ['1=1'], args = [];
    if (ctx.query.tag) { where.push('q.tag=?'); args.push(ctx.query.tag); }
    if (ctx.query.q && ctx.query.q.trim().length >= 2) { where.push('(q.title LIKE ? OR q.body LIKE ?)'); const t = `%${ctx.query.q.trim()}%`; args.push(t, t); }
    const rows = await ctx.db.all(`SELECT q.*, u.id uid, u.role, u.name, u.headline, u.avatar_file_id, u.trust_level, (SELECT COUNT(*) FROM answers WHERE question_id=q.id) answers FROM questions q JOIN users u ON u.id=q.user_id WHERE ${where.join(' AND ')} ORDER BY q.id DESC LIMIT 40`, ...args);
    return { questions: rows.map((q) => ({ id: q.id, title: q.title, body: q.body, tag: q.tag, created_at: q.created_at, answers: q.answers, author: authorOf(q) })) };
  });
  r.get('/api/questions/:id', async (ctx) => {
    const q = await ctx.db.one('SELECT q.*, u.id uid, u.role, u.name, u.headline, u.avatar_file_id, u.trust_level FROM questions q JOIN users u ON u.id=q.user_id WHERE q.id=?', ctx.params.id);
    if (!q) throw notFound();
    const answers = await ctx.db.all('SELECT a.id, a.body, a.created_at, u.id uid, u.role, u.name, u.headline, u.avatar_file_id, u.trust_level FROM answers a JOIN users u ON u.id=a.user_id WHERE a.question_id=? ORDER BY a.id ASC', q.id);
    return { question: { id: q.id, title: q.title, body: q.body, tag: q.tag, created_at: q.created_at, author: authorOf(q), mine: q.uid === ctx.user.id }, answers: answers.map((a) => ({ id: a.id, body: a.body, created_at: a.created_at, author: authorOf(a) })) };
  });
  r.post('/api/questions', async (ctx) => {
    requireVerified(ctx.user, 'ask a question');
    const b = await ctx.body();
    const tag = EXPERTISE.includes(b.tag) ? b.tag : null;
    const res = await ctx.db.run('INSERT INTO questions (user_id,title,body,tag,created_at) VALUES (?,?,?,?,?)', ctx.user.id, str(b.title, { min: 10, max: 160, name: 'Question' }), str(b.body, { max: 1500 }), tag, Date.now());
    return { id: res.meta.last_row_id };
  });
  r.post('/api/questions/:id/answers', async (ctx) => {
    requireVerified(ctx.user, 'answer questions');
    requireMentor(ctx.user);
    const b = await ctx.body();
    const q = await ctx.db.one('SELECT * FROM questions WHERE id=?', ctx.params.id);
    if (!q) throw notFound();
    await ctx.db.run('INSERT INTO answers (question_id,user_id,body,created_at) VALUES (?,?,?,?)', q.id, ctx.user.id, str(b.body, { min: 10, max: 2000, name: 'Answer' }), Date.now());
    if (q.user_id !== ctx.user.id) await notify(ctx.db, q.user_id, 'comment', ctx.user.id, `${ctx.user.name} answered your question.`, `#/mentors/qa/${q.id}`);
    await refreshTrust(ctx.db, ctx.user.id);
    return { ok: true };
  });
  r.del('/api/questions/:id', async (ctx) => {
    const q = await ctx.db.one('SELECT * FROM questions WHERE id=?', ctx.params.id);
    if (!q) throw notFound();
    if (q.user_id !== ctx.user.id && !ctx.user.is_admin) throw forbidden('You can only delete your own questions.');
    await ctx.db.run('DELETE FROM answers WHERE question_id=?', q.id);
    await ctx.db.run('DELETE FROM questions WHERE id=?', q.id);
    return { ok: true };
  });

  // ----- learning hub -----
  r.get('/api/resources', async (ctx) => {
    const where = ['1=1'], args = [];
    if (['guide', 'template', 'video', 'community'].includes(ctx.query.type)) { where.push('type=?'); args.push(ctx.query.type); }
    if (ctx.query.q && ctx.query.q.trim().length >= 2) { where.push('(title LIKE ? OR summary LIKE ? OR tags LIKE ?)'); const t = `%${ctx.query.q.trim()}%`; args.push(t, t, t); }
    const rows = await ctx.db.all(`SELECT id, type, title, summary, url, author_id, author_name, tags, created_at, (body IS NOT NULL AND body<>'') has_body FROM resources WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 60`, ...args);
    return { resources: rows.map((x) => ({ ...x, has_body: !!x.has_body, tags: x.tags ? x.tags.split(',') : [] })) };
  });
  r.get('/api/resources/:id', async (ctx) => {
    const x = await ctx.db.one('SELECT * FROM resources WHERE id=?', ctx.params.id);
    if (!x) throw notFound();
    return { resource: { ...x, tags: x.tags ? x.tags.split(',') : [], mine: x.author_id === ctx.user.id } };
  });
  r.post('/api/resources', async (ctx) => {
    requireVerified(ctx.user, 'share resources');
    const b = await ctx.body();
    const type = b.type === 'video' ? 'video' : 'community';
    const url = cleanUrl(b.url);
    if (type === 'video' && !url) throw bad('A video needs a link.');
    const body = str(b.body, { max: 4000 });
    if (!url && body.length < 40) throw bad('Add a link, or write at least 40 characters of content.');
    const res = await ctx.db.run('INSERT INTO resources (type,title,summary,body,url,author_id,author_name,tags,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      type, str(b.title, { min: 5, max: 120, name: 'Title' }), str(b.summary, { max: 280 }), body, url || null, ctx.user.id, ctx.user.name, list(b.tags, EXPERTISE.concat(STAGES), 4), Date.now());
    await refreshTrust(ctx.db, ctx.user.id);
    return { id: res.meta.last_row_id };
  });
  r.del('/api/resources/:id', async (ctx) => {
    const x = await ctx.db.one('SELECT * FROM resources WHERE id=?', ctx.params.id);
    if (!x) throw notFound();
    if (x.author_id !== ctx.user.id && !ctx.user.is_admin) throw forbidden('You can only delete your own resources.');
    await ctx.db.run('DELETE FROM resources WHERE id=?', x.id);
    return { ok: true };
  });
};
