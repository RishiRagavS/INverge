import { html, raw, state, api, actions, forms, inputs, icon, toast, busy, formData, avatar, trustBadge, roleTag, chips, qs, location_, usd, debounce, openModal, closeModal } from '../core.js';
import { go, needVerified } from '../nav.js';
import { halftone } from '../halftone.js';

// ---------- shared person widgets ----------
export const relationButtons = (u) => {
  const r = u.relation?.status;
  if (r === 'connected') return html`<a class="btn sm" href="#/messages/${u.id}">${icon('msg')} Message</a>`;
  if (r === 'sent') return html`<span class="btn sm off">Request sent</span><button class="btn ghost sm" data-act="conn-cancel" data-cid="${u.relation.id}" title="Withdraw request">${icon('x')}</button>`;
  if (r === 'received') return html`<button class="btn primary sm" data-act="conn-accept" data-cid="${u.relation.id}">Accept</button><button class="btn sm" data-act="conn-decline" data-cid="${u.relation.id}">Decline</button>`;
  return html`<button class="btn primary sm" data-act="connect" data-id="${u.id}">${icon('plus')} Connect</button>`;
};
export const personCard = (u, { extra = '', actions: acts } = {}) => html`<article class="card person" data-uid="${u.id}">
  <div class="top"><a href="#/profile/${u.id}">${avatar(u, 'md')}</a><div class="grow">
    <div class="row wrap gap-s"><a class="name" href="#/profile/${u.id}">${u.name}</a></div><div class="row gap-s wrap" style="margin:3px 0">${trustBadge(u.trust)}${roleTag(u.role)}</div>
    <div class="small">${u.startup_name ? html`<b>${u.startup_name}</b> · ` : ''}${u.headline || ''}</div><div class="tiny muted">${icon('globe', '')} ${location_(u)} · <span class="code">${u.code}</span></div></div></div>
  ${u.snippet ? html`<div class="small muted">${u.snippet}${u.snippet.length >= 140 ? '…' : ''}</div>` : ''}
  ${chips([...(u.industries || []).slice(0, 3), ...(u.role === 'mentor' ? (u.expertise || []).slice(0, 2) : [])], 'teal')}${extra}
  <div class="acts">${acts || html`<span class="conn-slot row gap-s">${relationButtons(u)}</span><a class="btn sm" href="#/profile/${u.id}">View</a><button class="btn sm ${u.saved ? 'saved' : ''}" data-act="save-user" data-id="${u.id}" aria-label="Save" title="Save">${icon('bookmark')}</button>`}</div></article>`;
export const personMini = (m) => html`<a class="row" href="#/profile/${m.id}" style="color:var(--ink)">${avatar(m, 'sm')}<div class="grow"><div style="font-weight:700;font-size:13px">${m.name}</div><div class="tiny muted">${m.why?.[0] || m.headline || ''}</div></div><span class="mono" style="font-weight:800">${m.score}</span></a>`;

const refreshCard = (id, u) => { document.querySelectorAll(`[data-uid="${id}"] .conn-slot`).forEach((s) => (s.innerHTML = relationButtons(u).s)); };
actions.connect = async (el) => {
  if (!needVerified('connect')) return;
  const id = Number(el.dataset.id), r = await busy(el, () => api.post('/connections', { to_id: id }));
  toast(r.status === 'connected' ? 'You are now connected!' : 'Connection request sent.');
  refreshCard(id, { id, relation: { status: r.status === 'connected' ? 'connected' : 'sent', id: r.id } });
  if (document.getElementById('profile-actions')) go(location.hash.slice(1));
};
const reload = () => go(location.hash.slice(1).split('?')[0]);
actions['conn-accept'] = async (el) => { if (!needVerified('respond')) return; await api.post(`/connections/${el.dataset.cid}/accept`); toast('Connected!'); reload(); };
actions['conn-decline'] = async (el) => { await api.post(`/connections/${el.dataset.cid}/decline`); toast('Request declined.'); reload(); };
actions['conn-cancel'] = async (el) => { await api.del(`/connections/${el.dataset.cid}`); toast('Request withdrawn.'); reload(); };
actions['conn-remove'] = async (el) => { if (!confirm('Remove this connection?')) return; await api.del(`/connections/${el.dataset.cid}`); toast('Connection removed.'); reload(); };
actions['save-user'] = async (el) => {
  const on = el.classList.contains('saved'); await (on ? api.del : api.post)(`/users/${el.dataset.id}/save`);
  document.querySelectorAll(`[data-act="save-user"][data-id="${el.dataset.id}"]`).forEach((b) => b.classList.toggle('saved', !on));
  toast(on ? 'Removed from saved.' : 'Saved to your list.');
};

// ---------- pitch & meeting modals ----------
actions.pitch = (el) => {
  if (!needVerified('send a pitch')) return;
  const me = state.me;
  openModal(html`<h2>Send a pitch</h2><p class="muted small">to <b>${el.dataset.name}</b>. Be specific: problem, traction, ask.</p>
    <form data-form="pitch" data-id="${el.dataset.id}"><label class="field"><textarea name="body" required minlength="20" maxlength="2000" rows="7">${me.role === 'founder' ? `Hi ${el.dataset.name.split(' ')[0]},\n\nI'm building ${me.startup_name || '[startup]'}. ${me.traction ? 'Traction: ' + me.traction + '. ' : ''}We are raising ${me.funding_goal ? '$' + me.funding_goal.toLocaleString() : '[amount]'} to reach [milestone].\n\nWould you be open to a short call?` : `Hi ${el.dataset.name.split(' ')[0]},\n\n`}</textarea></label>
    <button class="btn primary block">${icon('send')} Send pitch</button></form>`);
};
forms.pitch = async (f) => { await busy(f.querySelector('button'), () => api.post('/messages', { to_id: f.dataset.id, kind: 'pitch', body: formData(f).body })); closeModal(); toast('Pitch sent. Follow the conversation in Messages.'); };
actions.schedule = (el) => {
  if (!needVerified('schedule a meeting')) return;
  const d = new Date(Date.now() + 86400000 * 2); d.setMinutes(0, 0, 0); const v = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  openModal(html`<h2>Propose a meeting</h2><p class="muted small">with <b>${el.dataset.name}</b>. They'll see it in Messages.</p>
    <form data-form="meeting" data-id="${el.dataset.id}"><div class="form-grid"><label class="field"><span class="label">Date & time</span><input type="datetime-local" name="when" value="${v}" required></label>
    <label class="field"><span class="label">Length</span><select name="duration"><option>15</option><option selected>30</option><option>45</option><option>60</option></select></label></div>
    <label class="field"><span class="label">Note (optional)</span><textarea name="body" rows="3" maxlength="500" placeholder="What would you like to discuss?"></textarea></label><button class="btn primary block">${icon('cal')} Send request</button></form>`);
};
forms.meeting = async (f) => {
  const d = formData(f);
  await busy(f.querySelector('button'), () => api.post('/messages', { to_id: f.dataset.id, kind: 'meeting', body: d.body, meta: { when: new Date(d.when).getTime(), duration: Number(d.duration) } }));
  closeModal(); toast('Meeting request sent.');
};

// ---------- Rooms hub ----------
export function roomsView() {
  const rooms = [['/discover', 'compass', 'Discover', 'Search and filter verified founders, investors and mentors.'], ['/alignment', 'target', 'Alignment', 'Your best matches, with a plain-English reason for each.'], ['/mentors', 'cap', 'Mentor’s Room', 'Book sessions, ask public questions and read mentor reviews.'], ['/learning', 'book', 'Learning Hub', 'Pitch templates, investor guides and community resources.']];
  return { title: 'Rooms', main: html`<div class="pagehead"><div><div class="label bc">ROOMS // 00</div><h1>Choose a room</h1><p>Four spaces, each built for a different way to grow.</p></div></div>
    <div class="grid2">${rooms.map(([h, i, t, d], n) => html`<a href="#${h}" class="card brackets" style="color:var(--ink);text-decoration:none;min-height:170px;display:flex;flex-direction:column"><div class="row"><span class="label">ROOM 0${n + 1}</span><span class="right">${icon(i)}</span></div><h2 style="margin:16px 0 6px;font-size:24px">${t}</h2><p class="muted">${d}</p><span class="small" style="margin-top:auto;font-weight:700">Enter ${icon('chev')}</span></a>`)}</div>` };
}

// ---------- Discover ----------
const DS = { f: {}, offset: 0 };
const dsFilters = (countries) => {
  const m = state.meta, f = DS.f, opt = (arr, cur) => arr.map((x) => html`<option ${cur === x ? 'selected' : ''}>${x}</option>`);
  return html`<div class="filters" id="dsf"><label class="field"><span class="label">Search</span><input name="q" value="${f.q || ''}" placeholder="Name, startup, city" data-input="ds-search"></label>
    <label class="field"><span class="label">Role</span><select name="role" data-change="ds-filter"><option value="">Everyone</option>${['founder', 'investor', 'mentor'].map((r) => html`<option value="${r}" ${f.role === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}s</option>`)}</select></label>
    <label class="field"><span class="label">Industry</span><select name="industry" data-change="ds-filter"><option value="">Any</option>${opt(m.industries, f.industry)}</select></label>
    <label class="field"><span class="label">Stage</span><select name="stage" data-change="ds-filter"><option value="">Any</option>${opt(m.stages, f.stage)}</select></label>
    <label class="field"><span class="label">Country</span><select name="country" data-change="ds-filter"><option value="">Anywhere</option>${opt(countries, f.country)}</select></label>
    <label class="field"><span class="label">Min. trust</span><select name="trust" data-change="ds-filter"><option value="">Any</option><option value="1" ${f.trust === '1' ? 'selected' : ''}>Basic+</option><option value="2" ${f.trust === '2' ? 'selected' : ''}>Gold+</option><option value="3" ${f.trust === '3' ? 'selected' : ''}>Elite</option></select></label></div>`;
};
async function loadDiscover(reset) {
  const grid = document.getElementById('dsgrid'), more = document.getElementById('dsmore'); if (!grid) return;
  if (reset) { DS.offset = 0; grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; }
  const r = await api.get('/users' + qs({ ...DS.f, offset: DS.offset }));
  if (reset) grid.innerHTML = '';
  if (reset && !r.users.length) grid.innerHTML = html`<div class="empty" style="grid-column:1/-1"><h3>No members match these filters</h3><p class="muted">Try widening your search.</p></div>`.s;
  grid.insertAdjacentHTML('beforeend', r.users.map((u) => personCard(u).s).join('')); DS.offset += r.users.length; more.classList.toggle('hide', !r.has_more);
}
const readFilters = () => { const f = {}; document.querySelectorAll('#dsf [name]').forEach((e) => e.value && (f[e.name] = e.value)); DS.f = f; };
inputs['ds-filter'] = () => { readFilters(); loadDiscover(true); };
inputs['ds-search'] = debounce(() => { readFilters(); loadDiscover(true); }, 300);
actions['ds-more'] = () => loadDiscover(false);
export async function discoverView() {
  const first = await api.get('/users?offset=0');
  return { title: 'Discover', main: html`<div class="pagehead"><div><div class="label bc">ROOM // 01</div><h1>Discover</h1><p>Browse verified founders, investors and mentors worldwide.</p></div></div>${dsFilters(first.countries)}<div class="grid2" id="dsgrid"></div><div class="center" style="margin-top:16px"><button class="btn hide" id="dsmore" data-act="ds-more">Load more</button></div>`, after: () => { DS.f = {}; DS.offset = 0; loadDiscover(true); } };
}

// ---------- Alignment ----------
const matchCard = (m) => html`<article class="card match brackets" data-uid="${m.id}">
  <div class="score"><b>${m.score}</b><span>ALIGNMENT</span></div>
  <div class="grow col" style="gap:8px"><div class="row" style="align-items:flex-start"><a href="#/profile/${m.id}">${avatar(m)}</a><div class="grow"><a class="name" href="#/profile/${m.id}">${m.name}</a><div class="row gap-s wrap" style="margin:3px 0">${trustBadge(m.trust)}${roleTag(m.role)}<span class="code">${m.code}</span></div><div class="small">${m.startup_name ? html`<b>${m.startup_name}</b> · ` : ''}${m.headline || ''}</div></div></div>
    <div><div class="label">Why you align</div><ul class="why">${m.why.length ? m.why.map((w) => html`<li>${icon('check')}<span>${w}</span></li>`) : html`<li>${icon('check')}<span>Complementary roles on INverge</span></li>`}</ul></div>
    <div class="acts row wrap gap-s"><button class="btn primary sm" data-act="pitch" data-id="${m.id}" data-name="${m.name}">${icon('send')} ${state.me.role === 'founder' && m.role === 'investor' ? 'Pitch' : 'Introduce'}</button><button class="btn sm" data-act="schedule" data-id="${m.id}" data-name="${m.name}">${icon('cal')} Schedule</button>
    <button class="btn sm ${m.saved ? 'saved' : ''}" data-act="save-user" data-id="${m.id}">${icon('bookmark')} Save</button><button class="btn ghost sm" data-act="skip" data-id="${m.id}">Skip</button></div></div></article>`;
actions.skip = async (el) => { await api.post(`/alignment/${el.dataset.id}/skip`); const c = el.closest('.card'); c.style.transition = '.2s'; c.style.opacity = 0; setTimeout(() => c.remove(), 200); };
actions['skip-reset'] = async () => { await api.post('/alignment/reset'); toast('Skipped matches restored.'); reload(); };
export async function alignmentView() {
  const { matches } = await api.get('/alignment'), me = state.me;
  const need = { founder: 'investors and mentors', investor: 'founders and mentors', mentor: 'founders and investors' }[me.role];
  return { title: 'Alignment', main: html`<div class="pagehead"><div><div class="label bc">ROOM // 02</div><h1>Alignment</h1><p>Your best-fit ${need}, scored by industry, stage, ticket size, region and trust. Every score is explained.</p></div></div>
    ${!me.industries.length ? html`<div class="warn" style="margin-bottom:16px">${icon('warn')}<div class="grow"><b>BETTER MATCHES AHEAD</b><span class="small">Add your industries and stage so we can score you accurately.</span></div><a class="btn sm" href="#/me/edit">Add preferences</a></div>` : ''}
    <div class="col">${matches.length ? matches.map(matchCard) : html`<div class="empty"><h3>No new matches right now</h3><p class="muted">You have seen everyone for now. Check back as new members join.</p><button class="btn" data-act="skip-reset">Restore skipped matches</button></div>`}</div>
    ${matches.length ? html`<p class="center small muted" style="margin-top:18px"><a href="#" data-act="skip-reset">Restore skipped matches</a></p>` : ''}` };
}

// ---------- Network ----------
export async function networkView(p) {
  const tab = ['connected', 'sent', 'received', 'saved'].includes(p.tab) ? p.tab : 'connected';
  const { users, counts } = await api.get('/network?tab=' + tab);
  const T = [['connected', 'Connected'], ['received', 'Requests'], ['sent', 'Sent'], ['saved', 'Saved']];
  const acts = (u) => ({ connected: html`<a class="btn primary sm" href="#/messages/${u.id}">${icon('msg')} Message</a><a class="btn sm" href="#/profile/${u.id}">View</a><button class="btn ghost sm" data-act="conn-remove" data-cid="${u.relation.id}" title="Remove">${icon('trash')}</button>`, received: html`<button class="btn primary sm" data-act="conn-accept" data-cid="${u.relation.id}">Accept</button><button class="btn sm" data-act="conn-decline" data-cid="${u.relation.id}">Decline</button><a class="btn ghost sm" href="#/profile/${u.id}">View</a>`, sent: html`<span class="btn sm off">Pending</span><button class="btn sm" data-act="conn-cancel" data-cid="${u.relation.id}">Withdraw</button>`, saved: html`<span class="conn-slot row gap-s">${relationButtons(u)}</span><button class="btn sm saved" data-act="save-user" data-id="${u.id}">${icon('bookmark')}</button>` })[tab];
  return { title: 'Network', main: html`<div class="pagehead"><div><div class="label bc">NETWORK // ${counts.connected}</div><h1>My network</h1><p>Your connections, pending requests and saved profiles.</p></div></div>
    <div class="tabs">${T.map(([k, l]) => html`<a class="${k === tab ? 'on' : ''}" href="#/network/${k}">${l}<span class="n">${counts[k]}</span></a>`)}</div>
    ${users.length ? html`<div class="grid2">${users.map((u) => personCard(u, { actions: acts(u) }))}</div>` : html`<div class="empty"><h3>${{ connected: 'No connections yet', received: 'No pending requests', sent: 'No sent requests', saved: 'Nothing saved yet' }[tab]}</h3><p class="muted">Find people in Discover or Alignment.</p><a class="btn dark" href="#/alignment">Go to Alignment</a></div>`}` };
}
