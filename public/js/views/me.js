import { html, raw, state, api, actions, forms, inputs, icon, toast, busy, formData, prepareFile, avatar, trustBadge, roleTag, chips, location_, usd, ago, when, nl, stars, meter, bytes, openModal, closeModal } from '../core.js';
import { go, refreshMe } from '../nav.js';
import { barcode, halftone } from '../halftone.js';
import { relationButtons } from './people.js';
import { chipGroup, docSlot } from './onboarding.js';
import { countryList } from './auth.js';

const reload = () => go(location.hash.slice(1).split('?')[0]);
const kv = (rows) => html`<dl class="kv">${rows.filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => html`<dt>${k}</dt><dd>${Array.isArray(v) ? chips(v, 'teal') : v}</dd>`)}</dl>`;

// ======================= PUBLIC PROFILE =======================
export async function profileView(p) {
  const { profile: u, posts, reviews } = await api.get('/users/' + p.id), me = state.me;
  const acts = u.self ? html`<a class="btn primary" href="#/me/edit">${icon('edit')} Edit profile</a><a class="btn" href="#/me">Dashboard</a>` : html`<span class="conn-slot row gap-s">${relationButtons(u)}</span>${u.relation.status !== 'connected' ? html`<a class="btn sm" href="#/messages/${u.id}">${icon('msg')} Message</a>` : ''}
    ${u.role === 'investor' && me.role === 'founder' ? html`<button class="btn dark sm" data-act="pitch" data-id="${u.id}" data-name="${u.name}">${icon('send')} Pitch</button>` : ''}${u.role === 'mentor' && me.role !== 'mentor' ? html`<button class="btn dark sm" data-act="book" data-id="${u.id}" data-name="${u.name}">${icon('cal')} Book session</button>` : ''}
    <button class="btn sm" data-act="schedule" data-id="${u.id}" data-name="${u.name}">${icon('clock')} Schedule</button><button class="btn sm ${u.saved ? 'saved' : ''}" data-act="save-user" data-id="${u.id}">${icon('bookmark')}</button>`;
  const details = { founder: [['Startup', u.startup_name], ['Stage', u.stages], ['Funding goal', u.funding_goal ? usd(u.funding_goal) : null], ['Traction', u.traction], ['Industries', u.industries]], investor: [['Investor type', u.investor_type], ['Stages', u.stages], ['Typical cheque', u.ticket_min || u.ticket_max ? `${usd(u.ticket_min)} – ${usd(u.ticket_max)}` : null], ['Industries', u.industries], ['Portfolio', u.portfolio]], mentor: [['Expertise', u.expertise], ['Experience', u.years_exp ? u.years_exp + ' years' : null], ['Stages', u.stages], ['Industries', u.industries]] }[u.role];
  return { title: u.name, main: html`
    <div class="card brackets" style="padding:0;overflow:hidden"><div class="dots-teal" style="height:96px;opacity:.55;-webkit-mask-image:linear-gradient(90deg,#000,transparent);mask-image:linear-gradient(90deg,#000,transparent)"></div>
      <div style="padding:0 20px 20px;margin-top:-52px"><div class="row" style="align-items:flex-end;gap:16px;flex-wrap:wrap">${avatar(u, 'xl')}<div class="grow" style="min-width:220px;padding-top:56px"><h1 style="font-size:28px">${u.name}</h1><div class="row gap-s wrap" style="margin:6px 0">${trustBadge(u.trust)}${roleTag(u.role)}<span class="code">${u.code}</span></div><div>${u.startup_name ? html`<b>${u.startup_name}</b> · ` : ''}${u.headline || ''}</div><div class="small muted" style="margin-top:2px">${icon('globe')} ${location_(u)}</div></div></div>
      <div class="row wrap gap-s" id="profile-actions" style="margin-top:16px" data-uid="${u.id}">${acts}</div></div></div>
    <div class="card"><div class="sect" style="margin-top:0"><span class="label">About</span></div><p>${nl(u.bio || 'No bio yet.')}</p>${kv(details)}
      ${u.linkedin_url || u.website ? html`<div class="row wrap gap-s" style="margin-top:12px">${u.linkedin_url ? html`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${u.linkedin_url}">${icon('link')} LinkedIn</a>` : ''}${u.website ? html`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${u.website}">${icon('globe')} Website</a>` : ''}</div>` : ''}</div>
    ${u.deck ? html`<div class="card"><div class="sect" style="margin-top:0"><span class="label">Pitch deck</span></div><a class="btn dark" href="/api/files/${u.deck.file_id}" target="_blank" rel="noopener">${icon('file')} Open ${u.deck.name}</a><span class="small muted"> · shared with verified members</span></div>` : ''}
    ${u.role === 'mentor' ? html`<div class="card"><div class="row"><span class="label">Reviews</span>${u.rating?.avg ? html`${stars(u.rating.avg)}<b>${u.rating.avg}</b><span class="tiny muted">(${u.rating.n})</span>` : ''}${u.open_slots ? html`<span class="chip teal right">${u.open_slots} open slots</span>` : ''}</div>
      ${reviews.length ? reviews.map((r) => html`<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">${stars(r.rating)} <b class="small">${r.reviewer}</b> <span class="tiny muted">${ago(r.created_at)}</span><div class="small">${r.body}</div></div>`) : html`<p class="muted small" style="margin:10px 0 0">No reviews yet.</p>`}</div>` : ''}
    ${posts.length ? html`<div class="sect"><span class="label">Recent posts</span></div>${posts.map((x) => html`<div class="card flat"><div class="tiny muted mono">${ago(x.created_at)} · ${x.likes} ack · ${x.comments} comments</div><div style="margin-top:6px">${nl(x.body)}</div></div>`)}` : ''}`,
  rail: html`<div class="panel"><div class="label">Member ID</div><div class="mono" style="font-weight:800;font-size:22px;margin:4px 0 10px">${u.code}</div>${barcode(u.code)}<div class="tiny muted mono" style="margin-top:8px">Since ${new Date(u.member_since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div></div>
    <div class="card"><div class="label">Network</div><div class="row" style="margin-top:8px;gap:20px"><div><div class="mono" style="font-weight:800;font-size:22px">${u.connections}</div><div class="tiny muted">connections</div></div><div><div class="mono" style="font-weight:800;font-size:22px">${u.posts_count}</div><div class="tiny muted">posts</div></div></div></div>
    <div class="card"><div class="label">Trust · ${u.trust_label}</div>${meter((u.trust / 3) * 100, 3)}<p class="small muted" style="margin:10px 0 0">${['Not verified yet — browse-only account.', 'Email, ID and LinkedIn checked.', 'Documents reviewed and approved by INverge.', 'Gold-verified and active in the community.'][u.trust]}</p></div>` };
}

// ======================= DASHBOARD =======================
const tabsMe = (cur) => html`<div class="tabs">${[['', 'Overview'], ['edit', 'Edit profile'], ['settings', 'Settings']].map(([k, l]) => html`<a class="${(cur || '') === k ? 'on' : ''}" href="#/me${k ? '/' + k : ''}">${l}</a>`)}</div>`;
export async function meView(p) {
  const me = state.me, tab = p.tab || '';
  const head = html`<div class="pagehead"><div><div class="label bc">DASHBOARD // ${me.code}</div><h1>${me.name}</h1><p>${me.headline || 'Add a headline so people know what you do.'}</p></div><a class="btn" href="#/profile/${me.id}">${icon('eye')} Public profile</a></div>${tabsMe(tab)}`;
  if (tab === 'edit') return { title: 'Edit profile', main: html`${head}${editForm(me)}` };
  if (tab === 'settings') return { title: 'Settings', main: html`${head}<form class="card brackets" data-form="settings"><h3>Notifications</h3><div class="col gap-s" style="margin:12px 0 16px">${[['requests', 'Connection requests'], ['alignments', 'New alignments'], ['messages', 'Messages'], ['bookings', 'Booking updates']].map(([k, l]) => html`<label class="row"><input type="checkbox" name="np_${k}" ${me.notif_prefs[k] !== false ? 'checked' : ''}> ${l}</label>`)}</div><button class="btn primary">Save settings</button></form>
    <div class="card"><h3>Account</h3>${kv([['Email', me.email], ['Role', me.role + ' (permanent)'], ['Member ID', me.code], ['Trust level', me.trust_label]])}<button class="btn danger" style="margin-top:14px" data-act="logout">${icon('logout')} Log out</button></div>` };
  const a = await api.get('/me/analytics'), max = Math.max(1, ...a.views_14d.map((d) => d.n));
  const stat = (n, l) => html`<div class="card"><div class="mono" style="font-weight:800;font-size:30px;letter-spacing:-.04em">${n}</div><div class="label">${l}</div></div>`;
  return { title: 'Dashboard', main: html`${head}
    <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${stat(a.views_30d, 'Profile views · 30d')}${stat(a.connections, 'Connections')}${stat(a.saved_by, 'Saved by members')}${stat(a.reactions, 'Post acknowledgements')}${stat(a.pending_requests, 'Pending requests')}</div>
    <div class="card brackets" style="margin-top:14px"><div class="row"><span class="label">Profile views · last 14 days</span></div><div class="bars" style="margin-top:14px">${a.views_14d.map((d) => html`<i title="${d.day}: ${d.n}" style="height:${Math.max(4, (d.n / max) * 100)}%"></i>`)}</div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><span class="label">Profile completeness · ${me.completeness.percent}%</span><div style="margin:10px 0">${meter(me.completeness.percent)}</div>${me.completeness.missing.length ? html`<ul class="small" style="padding-left:18px;margin:0">${me.completeness.missing.map((m) => html`<li>${m}</li>`)}</ul><a class="btn sm" style="margin-top:12px" href="#/me/edit">Complete profile</a>` : html`<p class="small muted">Everything is filled in. Nice work.</p>`}</div>
    <div class="card"><span class="label">Trust badge</span><div style="margin:10px 0">${trustBadge(me.trust)}</div><p class="small muted">${me.trust < 3 ? 'Level up to unlock more visibility and credibility.' : 'You are Elite — the highest trust level.'}</p><a class="btn sm" href="#/verification">Open Verification Center</a></div></div>` };
}
const editForm = (me) => {
  const m = state.meta, num = (k, l, extra = '') => html`<label class="field"><span class="label">${l}</span><input type="number" name="${k}" min="0" value="${me[k] ?? ''}" ${raw(extra)}></label>`;
  return html`<form class="card brackets" data-form="edit">
    <div class="row" style="margin-bottom:16px">${avatar(me, 'lg')}<label class="field" style="margin:0"><span class="label">Profile photo</span><input type="file" accept="image/*" data-change="me-photo"></label></div>
    <div class="form-grid"><label class="field"><span class="label">Full name</span><input name="name" value="${me.name}" required></label><label class="field"><span class="label">Headline</span><input name="headline" maxlength="120" value="${me.headline || ''}"></label>
    <label class="field"><span class="label">Country</span><input name="country" list="countries" value="${me.country || ''}" required></label><label class="field"><span class="label">City</span><input name="city" value="${me.city || ''}" required></label>
    <label class="field"><span class="label">LinkedIn URL</span><input name="linkedin_url" value="${me.linkedin_url || ''}" placeholder="linkedin.com/in/…"></label><label class="field"><span class="label">Website</span><input name="website" value="${me.website || ''}" placeholder="https://"></label></div>${countryList}
    <label class="field"><span class="label">About</span><textarea name="bio" rows="5" maxlength="1200">${me.bio || ''}</textarea></label>
    <div class="field"><span class="label">Industries (up to 8)</span>${chipGroup('industries', m.industries, me.industries)}</div>
    ${me.role === 'founder' ? html`<div class="form-grid"><label class="field"><span class="label">Startup name</span><input name="startup_name" value="${me.startup_name || ''}"></label>${num('funding_goal', 'Funding goal (USD)')}</div><label class="field"><span class="label">Traction</span><input name="traction" maxlength="500" value="${me.traction || ''}"></label><div class="field"><span class="label">Stage</span>${chipGroup('stages', m.stages, me.stages, 'radio')}</div>` : ''}
    ${me.role === 'investor' ? html`<div class="form-grid"><label class="field"><span class="label">Investor type</span><select name="investor_type"><option value="">Select…</option>${m.investor_types.map((t) => html`<option ${me.investor_type === t ? 'selected' : ''}>${t}</option>`)}</select></label><div></div>${num('ticket_min', 'Cheque size min (USD)')}${num('ticket_max', 'Cheque size max (USD)')}</div><label class="field"><span class="label">Portfolio highlights</span><textarea name="portfolio" rows="3" maxlength="800">${me.portfolio || ''}</textarea></label><div class="field"><span class="label">Stages you invest in</span>${chipGroup('stages', m.stages, me.stages)}</div>` : ''}
    ${me.role === 'mentor' ? html`<div class="form-grid">${num('years_exp', 'Years of experience', 'max="60"')}<div></div></div><div class="field"><span class="label">Expertise (up to 6)</span>${chipGroup('expertise', m.expertise, me.expertise)}</div><div class="field"><span class="label">Stages you mentor</span>${chipGroup('stages', m.stages, me.stages)}</div>` : ''}
    <button class="btn primary lg">Save changes</button></form>`;
};
forms.edit = async (f) => {
  const d = formData(f), arr = (v) => [].concat(v || []), me = state.me, body = { ...d, industries: arr(d.industries) };
  if (me.role === 'founder') body.stages = arr(d.stages).slice(0, 1); else if (me.role !== undefined) body.stages = arr(d.stages);
  if (me.role === 'mentor') body.expertise = arr(d.expertise);
  await busy(f.querySelector('button.primary'), async () => { state.me = (await api.put('/me', body)).user; });
  toast('Profile saved.'); go('/me');
};
inputs['me-photo'] = async (el) => { try { const up = await api.post('/files', { kind: 'avatar', ...(await prepareFile(el.files[0], { avatar: true })) }); state.me = (await api.put('/me', { avatar_file_id: up.id })).user; toast('Photo updated.'); reload(); } catch (e) { toast(e.message, true); } };
forms.settings = async (f) => { const d = formData(f); state.me = (await api.put('/me', { notif_prefs: Object.fromEntries(['requests', 'alignments', 'messages', 'bookings'].map((k) => [k, !!d['np_' + k]])) })).user; toast('Settings saved.'); };

// ======================= VERIFICATION CENTER =======================
actions['doc-del'] = async (el) => { if (!confirm('Remove this document? Your badge may change.')) return; await api.del('/me/documents/' + el.dataset.id); await refreshMe(); toast('Document removed.'); reload(); };
actions['deck-public'] = async (el) => { await api.put('/me/documents/' + el.dataset.id, { is_public: el.checked }); toast(el.checked ? 'Deck visible to verified members.' : 'Deck is now private.'); };
forms.linkedin = async (f) => { await busy(f.querySelector('button'), async () => { state.me = (await api.put('/me', formData(f))).user; }); await refreshMe(); toast('LinkedIn saved.'); reload(); };
export async function verificationView() {
  const [v, { documents }] = await Promise.all([api.get('/me/verification'), api.get('/me/documents')]), me = state.me, kinds = state.meta.doc_kinds;
  state.me.trust = v.level;
  const st = (s) => ({ approved: 'approved', pending: 'pending', rejected: 'rejected' }[s] || '');
  const tier = (t) => html`<div class="card ${v.level >= t.level ? 'brackets' : ''}" style="${v.level >= t.level ? 'background:var(--teal-bg)' : ''}"><div class="row wrap"><span class="trust t${t.level}">${icon('shield')}${t.name}</span><b class="grow">${t.blurb}</b>${v.level >= t.level ? html`<span class="st approved">UNLOCKED</span>` : ''}</div>
    <div class="col gap-s" style="margin-top:12px">${t.items.map((i) => html`<div class="row" style="align-items:flex-start"><span style="margin-top:2px;color:${i.done ? 'var(--teal)' : 'var(--muted)'}">${icon(i.done ? 'check' : 'clock')}</span><div class="grow"><div class="${i.done ? '' : 'muted'}">${i.label}${i.progress ? html` <span class="mono small">${i.progress}</span>` : ''}</div>${i.hint && !i.done ? html`<div class="hint">${i.hint}</div>` : ''}${i.note ? html`<div class="err small">Rejected: ${i.note}</div>` : ''}</div></div>`)}</div></div>`;
  const mine = Object.entries(kinds).filter(([, s]) => s.roles.includes(me.role));
  return { title: 'Verification', main: html`<div class="pagehead"><div><div class="label bc">VERIFICATION CENTER</div><h1>Your trust badge: ${v.label}</h1><p>Verified members get messaging, connections, pitching and booking. Higher tiers earn more visibility.</p></div>${trustBadge(v.level)}</div>
    ${v.level < 1 ? html`<div class="warn" style="margin-bottom:16px"><span class="three"><i></i><i></i><i></i></span>${icon('warn')}<div><b>YOU ARE IN BROWSE-ONLY MODE</b><span class="small">Complete the Basic checklist below to unlock everything.</span></div></div>` : ''}
    <div class="col">${v.tiers.map(tier)}</div>
    <div class="sect"><span class="label">LinkedIn</span></div>
    <form class="card row wrap" data-form="linkedin"><input name="linkedin_url" value="${me.linkedin_url || ''}" placeholder="linkedin.com/in/yourname" style="flex:1;min-width:220px" aria-label="LinkedIn URL"><button class="btn primary">Save</button></form>
    <div class="sect"><span class="label">Documents</span></div><div id="docs-root">
    ${mine.map(([k, s]) => {
      const d = documents.filter((x) => x.kind === k);
      return html`${docSlot(k, s.label, k === 'gov_id' ? 'Passport, driving licence or national ID. JPG, PNG or PDF, under 1 MB.' : 'Accepted: ' + s.mimes.join(', ').toUpperCase() + ', under 1 MB.', d.length ? [{ kind: k, name: d[0].name, status: d[0].status, note: d[0].note }] : [], { required: k === 'gov_id' })}
        ${d.map((x) => html`<div class="row small" style="margin:-4px 0 12px 12px;gap:12px"><span class="muted">${bytes(x.size)} · uploaded ${ago(x.created_at)}</span>${k === 'pitch_deck' ? html`<label class="row gap-s"><input type="checkbox" data-act="deck-public" data-id="${x.id}" ${x.is_public ? 'checked' : ''}> Share with verified members</label>` : ''}<a href="/api/files/${x.file_id}" target="_blank" rel="noopener">View</a><button class="btn ghost sm" data-act="doc-del" data-id="${x.id}">${icon('trash')}</button></div>`)}`;
    })}</div><p class="small muted">Files are stored securely and only visible to you and INverge reviewers (pitch decks are shared only if you allow it).</p>` };
}

// ======================= NOTIFICATIONS =======================
export async function notificationsView() {
  const { notifications } = await api.get('/notifications');
  const unread = notifications.filter((n) => !n.read).length;
  if (unread) api.post('/notifications/read').then(() => { state.me.unread.notifications = 0; document.querySelectorAll('[data-badge="notif"]').forEach((e) => e.classList.add('hide')); });
  const ic = { connection_request: 'users', connection_accepted: 'check', message: 'msg', booking: 'cal', verification: 'shield', comment: 'comment' };
  return { title: 'Notifications', main: html`<div class="pagehead"><div><div class="label bc">INBOX // ${unread} NEW</div><h1>Notifications</h1><p>Requests, replies, bookings and verification updates.</p></div></div>
    ${notifications.length ? notifications.map((n) => html`<a class="doc" href="${n.link || '#/home'}" style="color:var(--ink);text-decoration:none;${n.read ? '' : 'border-left:6px solid var(--teal);background:var(--teal-bg)'}"><span class="avatar sm" style="background:var(--ink);color:var(--teal-l)">${icon(ic[n.type] || 'bell')}</span><div class="grow">${n.text}<div class="tiny muted mono">${ago(n.at)}</div></div>${icon('chev')}</a>`) : html`<div class="empty"><h3>You're all caught up</h3><p class="muted">New activity will show up here.</p></div>`}` };
}

// ======================= ADMIN =======================
const AD = { status: 'pending' };
actions['ad-status'] = (el) => { AD.status = el.dataset.s; reload(); };
actions['ad-approve'] = async (el) => { await api.post(`/admin/documents/${el.dataset.id}/review`, { status: 'approved' }); toast('Approved.'); reload(); };
actions['ad-reject'] = (el) => openModal(html`<h2>Reject document</h2><p class="muted small">The member sees this reason, so be clear and kind.</p><form data-form="reject" data-id="${el.dataset.id}"><label class="field"><textarea name="note" required maxlength="300" rows="3" placeholder="e.g. The ID photo is blurry — please upload a clearer scan."></textarea></label><button class="btn danger block">Reject</button></form>`);
forms.reject = async (f) => { await busy(f.querySelector('button'), () => api.post(`/admin/documents/${f.dataset.id}/review`, { status: 'rejected', note: formData(f).note })); closeModal(); toast('Rejected.'); reload(); };
export async function adminView() {
  if (!state.me.is_admin) { go('/home'); return html``; }
  const { documents, stats } = await api.get('/admin/documents?status=' + AD.status);
  return { title: 'Admin', main: html`<div class="pagehead"><div><div class="label bc">ADMIN // DOCUMENT REVIEW</div><h1>Verification queue</h1><p>Review uploaded documents. Approving a Gold requirement upgrades the member automatically.</p></div></div>
    <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:14px">${[[stats.users, 'Members'], [stats.pending, 'Pending docs'], [stats.posts, 'Posts'], [stats.messages, 'Messages']].map(([n, l]) => html`<div class="card"><div class="mono" style="font-weight:800;font-size:26px">${n}</div><div class="label">${l}</div></div>`)}</div>
    <div class="tabs">${['pending', 'approved', 'rejected'].map((s) => html`<button class="${AD.status === s ? 'on' : ''}" data-act="ad-status" data-s="${s}">${s}</button>`)}</div>
    ${documents.length ? documents.map((d) => html`<div class="doc"><div class="grow"><div class="row wrap gap-s"><b>${d.label}</b><span class="st ${d.status}">${d.status}</span><span class="code">${d.code}</span></div><div class="small"><a href="#/profile/${d.user_id}">${d.user_name}</a> · ${d.role} · ${d.country || ''} · ${bytes(d.size)} · ${ago(d.created_at)}</div>
      <div class="small muted">${d.linkedin_url ? html`<a href="${d.linkedin_url}" target="_blank" rel="noopener noreferrer">LinkedIn</a> · ` : ''}file: ${d.name}</div>${d.note ? html`<div class="small err">${d.note}</div>` : ''}</div>
      <div class="row gap-s wrap"><a class="btn sm" href="/api/files/${d.file_id}" target="_blank" rel="noopener">${icon('eye')} Open</a>${d.status !== 'approved' ? html`<button class="btn primary sm" data-act="ad-approve" data-id="${d.id}">Approve</button>` : ''}${d.status !== 'rejected' ? html`<button class="btn danger sm" data-act="ad-reject" data-id="${d.id}">Reject</button>` : ''}</div></div>`) : html`<div class="empty">Nothing ${AD.status}.</div>`}` };
}
