import { bad, forbidden, notFound, str, csv, POST_TYPES, publicUser, requireVerified, refreshTrust, notify, codeFor } from '../lib.js';
import { decorate } from './profile.js';

const POST_ROLE = { funding: 'founder', call: 'investor', insight: 'mentor' }; // role-restricted post types

const authorOf = (r) => ({ id: r.uid, code: codeFor(r.role, r.uid), role: r.role, name: r.name, headline: r.headline, avatar: r.avatar_file_id || null, trust: r.trust_level, startup_name: r.startup_name });

async function loadPosts(ctx, { where = '1=1', args = [], limit = 15 } = {}) {
  const me = ctx.user.id;
  const rows = await ctx.db.all(
    `SELECT p.id, p.type, p.body, p.created_at, u.id uid, u.role, u.name, u.headline, u.avatar_file_id, u.trust_level, u.startup_name,
       (SELECT COUNT(*) FROM post_reactions WHERE post_id=p.id) likes,
       (SELECT COUNT(*) FROM comments WHERE post_id=p.id) comments,
       (SELECT COUNT(*) FROM post_shares WHERE post_id=p.id) shares,
       EXISTS(SELECT 1 FROM post_reactions WHERE post_id=p.id AND user_id=?) liked,
       EXISTS(SELECT 1 FROM post_saves WHERE post_id=p.id AND user_id=?) saved
     FROM posts p JOIN users u ON u.id=p.user_id WHERE ${where} ORDER BY p.id DESC LIMIT ?`, me, me, ...args, limit);
  return rows.map((r) => ({
    id: r.id, type: r.type, body: r.body, created_at: r.created_at, author: authorOf(r),
    likes: r.likes, comments: r.comments, shares: r.shares, liked: !!r.liked, saved: !!r.saved,
    hot: r.likes + r.comments * 2 >= 8, mine: r.uid === me,
  }));
}

export default (r) => {
  // ----- feed -----
  r.get('/api/feed', async (ctx) => {
    const { filter = 'all', before } = ctx.query, me = ctx.user.id;
    const where = [], args = [];
    if (POST_TYPES.includes(filter)) { where.push('p.type=?'); args.push(filter); }
    if (filter === 'saved') where.push(`p.id IN (SELECT post_id FROM post_saves WHERE user_id=${Number(me)})`);
    if (filter === 'network') where.push(`(p.user_id=${Number(me)} OR p.user_id IN (SELECT CASE WHEN requester_id=${Number(me)} THEN addressee_id ELSE requester_id END FROM connections WHERE status='accepted' AND (requester_id=${Number(me)} OR addressee_id=${Number(me)})))`);
    if (before && Number(before) > 0) { where.push('p.id<?'); args.push(Number(before)); }
    const posts = await loadPosts(ctx, { where: where.join(' AND ') || '1=1', args, limit: 15 });
    return { posts, next: posts.length === 15 ? posts[posts.length - 1].id : null };
  });

  r.post('/api/posts', async (ctx) => {
    requireVerified(ctx.user, 'post to the feed');
    const b = await ctx.body();
    const type = POST_TYPES.includes(b.type) ? b.type : 'update';
    if (POST_ROLE[type] && POST_ROLE[type] !== ctx.user.role) throw forbidden(`Only ${POST_ROLE[type]}s can publish ${type} posts.`);
    const body = str(b.body, { min: 3, max: 1500, name: 'Post' });
    const res = await ctx.db.run('INSERT INTO posts (user_id,type,body,created_at) VALUES (?,?,?,?)', ctx.user.id, type, body, Date.now());
    await refreshTrust(ctx.db, ctx.user.id);
    const [post] = await loadPosts(ctx, { where: 'p.id=?', args: [res.meta.last_row_id], limit: 1 });
    return { post };
  });

  r.del('/api/posts/:id', async (ctx) => {
    const p = await ctx.db.one('SELECT * FROM posts WHERE id=?', ctx.params.id);
    if (!p) throw notFound();
    if (p.user_id !== ctx.user.id && !ctx.user.is_admin) throw forbidden('You can only delete your own posts.');
    for (const t of ['post_reactions', 'post_saves', 'post_shares', 'comments']) await ctx.db.run(`DELETE FROM ${t} WHERE post_id=?`, p.id);
    await ctx.db.run('DELETE FROM posts WHERE id=?', p.id);
    return { ok: true };
  });

  const toggle = (table, flag) => async (ctx) => {
    const id = Number(ctx.params.id);
    if (!(await ctx.db.one('SELECT id FROM posts WHERE id=?', id))) throw notFound();
    const has = await ctx.db.one(`SELECT 1 x FROM ${table} WHERE post_id=? AND user_id=?`, id, ctx.user.id);
    if (has) await ctx.db.run(`DELETE FROM ${table} WHERE post_id=? AND user_id=?`, id, ctx.user.id);
    else await ctx.db.run(`INSERT INTO ${table} (post_id,user_id) VALUES (?,?)`, id, ctx.user.id);
    const n = await ctx.db.one(`SELECT COUNT(*) n FROM ${table} WHERE post_id=?`, id);
    return { [flag]: !has, count: n.n };
  };
  r.post('/api/posts/:id/react', toggle('post_reactions', 'liked'));
  r.post('/api/posts/:id/save', toggle('post_saves', 'saved'));
  r.post('/api/posts/:id/share', async (ctx) => {
    const id = Number(ctx.params.id);
    if (!(await ctx.db.one('SELECT id FROM posts WHERE id=?', id))) throw notFound();
    await ctx.db.run('INSERT OR IGNORE INTO post_shares (post_id,user_id) VALUES (?,?)', id, ctx.user.id);
    return { count: (await ctx.db.one('SELECT COUNT(*) n FROM post_shares WHERE post_id=?', id)).n };
  });

  // ----- comments -----
  r.get('/api/posts/:id/comments', async (ctx) => {
    const rows = await ctx.db.all('SELECT c.id, c.body, c.created_at, u.id uid, u.role, u.name, u.headline, u.avatar_file_id, u.trust_level, u.startup_name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC LIMIT 60', ctx.params.id);
    return { comments: rows.map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: authorOf(c) })) };
  });
  r.post('/api/posts/:id/comments', async (ctx) => {
    requireVerified(ctx.user, 'comment');
    const b = await ctx.body();
    const post = await ctx.db.one('SELECT * FROM posts WHERE id=?', ctx.params.id);
    if (!post) throw notFound();
    const body = str(b.body, { min: 1, max: 600, name: 'Comment' });
    await ctx.db.run('INSERT INTO comments (post_id,user_id,body,created_at) VALUES (?,?,?,?)', post.id, ctx.user.id, body, Date.now());
    if (post.user_id !== ctx.user.id) await notify(ctx.db, post.user_id, 'comment', ctx.user.id, `${ctx.user.name} commented on your post.`, '#/home');
    await refreshTrust(ctx.db, ctx.user.id);
    return { ok: true };
  });

  // ----- messaging -----
  r.get('/api/conversations', async (ctx) => {
    const me = ctx.user.id;
    const last = await ctx.db.all(
      `SELECT m.*, CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END other_id FROM messages m
       WHERE m.id IN (SELECT MAX(id) FROM messages WHERE sender_id=? OR recipient_id=? GROUP BY CASE WHEN sender_id=? THEN recipient_id ELSE sender_id END)
       ORDER BY m.id DESC LIMIT 50`, me, me, me, me);
    if (!last.length) return { conversations: [] };
    const ids = last.map((m) => m.other_id), ph = ids.map(() => '?').join(',');
    const [users, unread] = await Promise.all([
      ctx.db.all(`SELECT * FROM users WHERE id IN (${ph})`, ...ids),
      ctx.db.all('SELECT sender_id, COUNT(*) n FROM messages WHERE recipient_id=? AND read_at IS NULL GROUP BY sender_id', me),
    ]);
    return {
      conversations: last.map((m) => ({
        user: publicUser(users.find((u) => u.id === m.other_id)),
        last: { body: m.kind === 'meeting' ? 'Meeting request' : m.file_name && !m.body ? '📎 ' + m.file_name : m.body.slice(0, 90), mine: m.sender_id === me, at: m.created_at, kind: m.kind },
        unread: unread.find((x) => x.sender_id === m.other_id)?.n || 0,
      })),
    };
  });

  r.get('/api/messages/:userId', async (ctx) => {
    const me = ctx.user, other = await ctx.db.one('SELECT * FROM users WHERE id=? AND email_verified=1', ctx.params.userId);
    if (!other) throw notFound('Member not found');
    const after = Number(ctx.query.after) || 0;
    await ctx.db.run('UPDATE messages SET read_at=? WHERE recipient_id=? AND sender_id=? AND read_at IS NULL', Date.now(), me.id, other.id);
    const rows = await ctx.db.all('SELECT * FROM (SELECT * FROM messages WHERE id>? AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) ORDER BY id DESC LIMIT 100) ORDER BY id ASC', after, me.id, other.id, other.id, me.id);
    await ctx.db.run("UPDATE notifications SET read=1 WHERE user_id=? AND actor_id=? AND type='message'", me.id, other.id);
    const [o] = await decorate(ctx, [other]);
    return {
      other: o,
      can_message: me.trust_level >= 1 && other.trust_level >= 1,
      block_reason: me.trust_level < 1 ? 'Verify your identity to start messaging.' : other.trust_level < 1 ? 'This member has not completed verification yet.' : null,
      messages: rows.map((m) => {
        let meta = null; try { meta = m.meta ? JSON.parse(m.meta) : null; } catch { /* ignore */ }
        return { id: m.id, mine: m.sender_id === me.id, kind: m.kind, body: m.body, file: m.file_id ? { id: m.file_id, name: m.file_name } : null, meta, at: m.created_at, read: !!m.read_at };
      }),
    };
  });

  r.post('/api/messages', async (ctx) => {
    const me = ctx.user;
    requireVerified(me, 'send messages');
    const b = await ctx.body(), toId = Number(b.to_id);
    if (!toId || toId === me.id) throw bad('Invalid recipient.');
    const other = await ctx.db.one('SELECT * FROM users WHERE id=? AND email_verified=1', toId);
    if (!other) throw notFound('Member not found');
    if (other.trust_level < 1) throw bad('This member has not completed verification yet, so they cannot receive messages.');
    const kind = ['text', 'pitch', 'meeting'].includes(b.kind) ? b.kind : 'text';
    let body = str(b.body, { max: 2000 }), meta = null, fileId = null, fileName = null;
    if (kind === 'pitch' && body.length < 20) throw bad('Write a short pitch (at least 20 characters).');
    if (kind === 'meeting') {
      const when = Number(b.meta?.when);
      if (!when || when < Date.now()) throw bad('Choose a future date and time for the meeting.');
      meta = JSON.stringify({ when, duration: Math.min(120, Math.max(15, Number(b.meta?.duration) || 30)) });
      if (!body) body = 'Would you be open to a short call?';
    }
    if (b.file_id) {
      const f = await ctx.db.one("SELECT id, name FROM files WHERE id=? AND owner_id=? AND kind='attachment'", b.file_id, me.id);
      if (!f) throw bad('Attachment not found.');
      fileId = f.id; fileName = f.name;
    }
    if (!body && !fileId) throw bad('Message is empty.');
    const res = await ctx.db.run('INSERT INTO messages (sender_id,recipient_id,kind,body,file_id,file_name,meta,created_at) VALUES (?,?,?,?,?,?,?,?)', me.id, toId, kind, body, fileId, fileName, meta, Date.now());
    const dupe = await ctx.db.one("SELECT id FROM notifications WHERE user_id=? AND actor_id=? AND type='message' AND read=0", toId, me.id);
    if (!dupe) await notify(ctx.db, toId, 'message', me.id, kind === 'pitch' ? `${me.name} sent you a pitch.` : kind === 'meeting' ? `${me.name} proposed a meeting.` : `New message from ${me.name}.`, `#/messages/${me.id}`);
    return { id: res.meta.last_row_id };
  });

  // ----- notifications -----
  r.get('/api/counts', async (ctx) => {
    const [n, m] = await Promise.all([
      ctx.db.one('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', ctx.user.id),
      ctx.db.one('SELECT COUNT(*) n FROM messages WHERE recipient_id=? AND read_at IS NULL', ctx.user.id),
    ]);
    return { notifications: n.n, messages: m.n };
  });
  r.get('/api/notifications', async (ctx) => {
    const rows = await ctx.db.all('SELECT n.*, u.name actor_name, u.avatar_file_id actor_avatar, u.role actor_role FROM notifications n LEFT JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 50', ctx.user.id);
    return { notifications: rows.map((n) => ({ id: n.id, type: n.type, text: n.text, link: n.link, read: !!n.read, at: n.created_at, actor: n.actor_id ? { id: n.actor_id, name: n.actor_name, avatar: n.actor_avatar, role: n.actor_role } : null })) };
  });
  r.post('/api/notifications/read', async (ctx) => {
    await ctx.db.run('UPDATE notifications SET read=1 WHERE user_id=?', ctx.user.id);
    return { ok: true };
  });
};
