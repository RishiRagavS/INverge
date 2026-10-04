import { html, raw, state, api, actions, forms, inputs, icon, toast, busy, formData, avatar, trustBadge, roleTag, ago, when, nl, prepareFile } from '../core.js';
import { go, updateBadges, needVerified } from '../nav.js';

const M = { id: null, last: 0, file: null, other: null };

const bubble = (m) => html`<div class="bub ${m.mine ? 'mine' : ''} ${m.kind}" data-mid="${m.id}">
  ${m.kind === 'pitch' ? html`<span class="tag">▌PITCH</span>` : ''}${m.kind === 'meeting' ? html`<span class="tag">▌MEETING REQUEST</span><b>${when(m.meta?.when)}</b> · ${m.meta?.duration} min<br>` : ''}${m.body ? nl(m.body) : ''}
  ${m.file ? html`<div style="margin-top:6px"><a href="/api/files/${m.file.id}" target="_blank" rel="noopener">${icon('clip')} ${m.file.name}</a></div>` : ''}
  <span class="meta">${ago(m.at)}${m.mine ? (m.read ? ' · ✓✓ seen' : ' · ✓ sent') : ''}</span></div>`;

const convRow = (c, cur) => html`<a class="conv ${cur === c.user.id ? 'on' : ''}" href="#/messages/${c.user.id}">${avatar(c.user)}<div class="grow"><div class="row"><b class="grow" style="font-size:14px">${c.user.name}</b>${c.unread ? html`<span class="un">${c.unread}</span>` : ''}</div>
  <div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.last.mine ? 'You: ' : ''}${c.last.body}</div></div></a>`;

async function poll() {
  if (!M.id || document.hidden) return;
  try {
    const r = await api.get(`/messages/${M.id}?after=${M.last}`);
    if (r.messages.length) {
      const box = document.getElementById('bubbles'), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.insertAdjacentHTML('beforeend', r.messages.map((m) => bubble(m).s).join('')); M.last = r.messages[r.messages.length - 1].id;
      if (atBottom) box.scrollTop = box.scrollHeight;
    }
    M.n = (M.n || 0) + 1;
    if (M.n % 4 === 0 || r.messages.length) { // refresh "seen" ticks and counters occasionally
      const seen = await api.get(`/messages/${M.id}`); seen.messages.forEach((m) => { if (m.mine && m.read) { const el = document.querySelector(`[data-mid="${m.id}"] .meta`); if (el && !el.textContent.includes('seen')) el.textContent = el.textContent.replace('✓ sent', '✓✓ seen'); } });
      const c = await api.get('/counts'); state.me.unread = c; updateBadges();
    }
  } catch { /* transient */ }
}

forms.send = async (f) => {
  const body = formData(f).body.trim(); if (!body && !M.file) return;
  const r = await busy(f.querySelector('button'), () => api.post('/messages', { to_id: M.id, body, file_id: M.file?.id }));
  f.reset(); M.file = null; document.getElementById('attached').textContent = ''; await poll();
};
inputs['msg-file'] = async (el) => {
  if (!needVerified('share files')) { el.value = ''; return; }
  try { const up = await prepareFile(el.files[0]); const r = await api.post('/files', { kind: 'attachment', ...up }); M.file = { id: r.id, name: r.name }; document.getElementById('attached').textContent = '📎 ' + r.name; } catch (e) { toast(e.message, true); } el.value = '';
};

export async function messagesView(p, ctx) {
  const { conversations } = await api.get('/conversations'), id = p.id ? Number(p.id) : null;
  M.id = id; M.file = null; M.last = 0;
  let thread = html`<div class="grow" style="display:grid;place-items:center;text-align:center;padding:30px" ><div>${icon('msg')}<h3 style="margin:10px 0 4px">Select a conversation</h3><p class="muted small">Or start one from a profile, Discover or Alignment.</p></div></div>`;
  if (id) {
    const r = await api.get('/messages/' + id); M.other = r.other; M.last = r.messages.length ? r.messages[r.messages.length - 1].id : 0;
    thread = html`<div class="hd"><a class="btn ghost sm backbtn" href="#/messages" aria-label="Back">${icon('back')}</a><a href="#/profile/${r.other.id}">${avatar(r.other)}</a><div class="grow"><a class="name" href="#/profile/${r.other.id}">${r.other.name}</a><div class="row gap-s">${trustBadge(r.other.trust)}${roleTag(r.other.role)}</div></div>
        ${r.can_message ? html`<button class="btn sm" data-act="schedule" data-id="${r.other.id}" data-name="${r.other.name}">${icon('cal')}<span class="w"> Meeting</span></button>` : ''}</div>
      <div class="bubbles" id="bubbles">${r.messages.length ? r.messages.map(bubble) : html`<div class="center muted small" style="margin:auto">No messages yet — say hello.</div>`}</div>
      ${r.can_message ? html`<form class="composer" data-form="send"><label class="btn" title="Attach file" style="cursor:pointer">${icon('clip')}<input type="file" hidden data-change="msg-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.docx"></label><div class="grow"><div class="tiny muted" id="attached"></div><textarea name="body" rows="1" placeholder="Write a message… (Enter to send)" maxlength="2000" id="msgbox" aria-label="Message"></textarea></div><button class="btn primary">${icon('send')}</button></form>`
        : html`<div class="warn" style="margin:10px">${icon('lock')}<div class="grow"><b>MESSAGING LOCKED</b><span class="small">${r.block_reason}</span></div>${state.me.trust < 1 ? html`<a class="btn sm" href="#/verification">Verify</a>` : ''}</div>`}`;
  }
  const timer = setInterval(poll, 8000); ctx.onLeave(() => { clearInterval(timer); M.id = null; });
  return { title: 'Messages', main: html`<div class="msgs ${id ? 'in-thread' : ''}"><aside class="convs">${conversations.length ? conversations.map((c) => convRow(c, id)) : html`<div class="empty" style="margin:12px;border-style:dashed"><b>No conversations yet</b><p class="small muted">Find people in <a href="#/alignment">Alignment</a>.</p></div>`}</aside><section class="thread">${thread}</section></div>`,
    after: async () => { const b = document.getElementById('bubbles'); if (b) b.scrollTop = b.scrollHeight; const t = document.getElementById('msgbox'); t?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.closest('form').requestSubmit(); } }); if (id) { const c = await api.get('/counts'); state.me.unread = c; updateBadges(); } } };
}
