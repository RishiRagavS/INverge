import { html, state, api, actions, forms, inputs, icon, toast, busy, formData, avatar, trustBadge, chips, qs, location_, stars, ago, when, nl, debounce, openModal, closeModal } from '../core.js';
import { go, needVerified } from '../nav.js';

const reload = () => go(location.hash.slice(1).split('?')[0]);
const tabs = (cur) => {
  const T = [['', 'Mentors'], ['qa', 'Public Q&A'], ['sessions', 'My sessions']]; if (state.me.role === 'mentor') T.push(['availability', 'My availability']);
  return html`<div class="tabs">${T.map(([k, l]) => html`<a class="${(cur || '') === k ? 'on' : ''}" href="#/mentors${k ? '/' + k : ''}">${l}</a>`)}</div>`;
};
const head = (t, d) => html`<div class="pagehead"><div><div class="label bc">ROOM // 03</div><h1>${t}</h1><p>${d}</p></div></div>`;

// ---------- directory ----------
const MD = { f: {} };
const mentorCard = (m) => html`<article class="card person" data-uid="${m.id}">
  <div class="top"><a href="#/profile/${m.id}">${avatar(m, 'md')}</a><div class="grow"><a class="name" href="#/profile/${m.id}">${m.name}</a><div class="row gap-s wrap" style="margin:3px 0">${trustBadge(m.trust)}<span class="code">${m.code}</span></div><div class="small">${m.headline || ''}</div><div class="tiny muted">${location_(m)} · ${m.years_exp || '—'} yrs experience</div></div></div>
  <div class="row gap-s">${m.rating ? html`${stars(m.rating)} <b class="small">${m.rating}</b><span class="tiny muted">(${m.reviews} review${m.reviews === 1 ? '' : 's'})</span>` : html`<span class="tiny muted">No reviews yet</span>`}</div>
  ${chips(m.expertise, 'teal')}<div class="small muted">${m.snippet}${m.snippet.length >= 140 ? '…' : ''}</div>
  <div class="acts"><button class="btn primary sm ${m.open_slots ? '' : 'off'}" data-act="book" data-id="${m.id}" data-name="${m.name}">${icon('cal')} ${m.open_slots ? `Book · ${m.open_slots} slots` : 'No open slots'}</button><a class="btn sm" href="#/profile/${m.id}">Profile</a><a class="btn ghost sm" href="#/messages/${m.id}">${icon('msg')}</a></div>
  ${m.next_slot ? html`<div class="tiny muted mono">NEXT: ${when(m.next_slot)}</div>` : ''}</article>`;
async function loadMentors() {
  const g = document.getElementById('mgrid'); if (!g) return; g.innerHTML = '<div class="skeleton"></div>';
  const { mentors } = await api.get('/mentors' + qs(MD.f));
  g.innerHTML = mentors.length ? mentors.map((m) => mentorCard(m).s).join('') : html`<div class="empty" style="grid-column:1/-1"><h3>No mentors match</h3><p class="muted">Try different filters.</p></div>`.s;
}
const readM = () => { const f = {}; document.querySelectorAll('#mf [name]').forEach((e) => e.value && (f[e.name] = e.value)); MD.f = f; loadMentors(); };
inputs['m-filter'] = readM; inputs['m-search'] = debounce(readM, 300);
actions.book = async (el) => {
  if (!needVerified('book a session')) return;
  if (state.me.role === 'mentor') return toast('Mentors cannot book sessions.', true);
  const { slots } = await api.get(`/mentors/${el.dataset.id}/slots`);
  openModal(html`<h2>Book ${el.dataset.name}</h2>${slots.length ? html`<form data-form="book"><div class="label" style="margin:10px 0 6px">Choose a time (your local time)</div>
    <div class="col gap-s" style="max-height:220px;overflow:auto;margin-bottom:12px">${slots.map((s, i) => html`<label class="doc" style="margin:0;cursor:pointer"><input type="radio" name="slot_id" value="${s.id}" ${i === 0 ? 'checked' : ''}><div class="grow"><b>${when(s.starts_at)}</b></div><span class="chip">${s.duration_min} min</span></label>`)}</div>
    <label class="field"><span class="label">What would you like help with?</span><textarea name="topic" rows="3" required minlength="5" maxlength="300" placeholder="e.g. Review my seed pitch narrative"></textarea></label><button class="btn primary block">Confirm booking</button></form>` : html`<p class="muted">No open slots right now. Send a message to ask for availability.</p><a class="btn" href="#/messages/${el.dataset.id}">Message mentor</a>`}`);
};
forms.book = async (f) => { const d = formData(f); await busy(f.querySelector('button'), () => api.post('/bookings', d)); closeModal(); toast('Session booked! Find it under My sessions.'); go('/mentors/sessions'); };

async function directory() {
  const m = state.meta; MD.f = {};
  return { title: 'Mentor’s Room', main: html`${head('Mentor’s Room', 'Book experienced mentors, ask public questions, and learn from verified operators.')}${tabs('')}
    <div class="filters" id="mf"><label class="field"><span class="label">Search</span><input name="q" data-input="m-search" placeholder="Name or topic"></label>
    <label class="field"><span class="label">Expertise</span><select name="expertise" data-change="m-filter"><option value="">Any</option>${m.expertise.map((x) => html`<option>${x}</option>`)}</select></label>
    <label class="field"><span class="label">Stage</span><select name="stage" data-change="m-filter"><option value="">Any</option>${m.stages.map((x) => html`<option>${x}</option>`)}</select></label>
    <label class="field"><span class="label">Min. trust</span><select name="trust" data-change="m-filter"><option value="">Any</option><option value="1">Basic+</option><option value="2">Gold+</option><option value="3">Elite</option></select></label>
    <label class="field"><span class="label">Sort</span><select name="sort" data-change="m-filter"><option value="">Top rated</option><option value="experience">Most experienced</option><option value="newest">Newest</option></select></label></div>
    <div class="grid2" id="mgrid"></div>`, after: loadMentors };
}

// ---------- sessions ----------
actions['b-cancel'] = async (el) => { if (!confirm('Cancel this session?')) return; await api.post(`/bookings/${el.dataset.id}/cancel`); toast('Session cancelled.'); reload(); };
actions['b-complete'] = async (el) => { await api.post(`/bookings/${el.dataset.id}/complete`); toast('Marked complete. The mentee can now leave a review.'); reload(); };
actions['b-review'] = (el) => openModal(html`<h2>Review ${el.dataset.name}</h2><form data-form="review" data-id="${el.dataset.id}"><label class="field"><span class="label">Rating</span><select name="rating"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select></label><label class="field"><span class="label">Comments (optional)</span><textarea name="body" rows="3" maxlength="500"></textarea></label><button class="btn primary block">Submit review</button></form>`);
forms.review = async (f) => { await busy(f.querySelector('button'), () => api.post(`/bookings/${f.dataset.id}/review`, formData(f))); closeModal(); toast('Thanks for your review!'); reload(); };
async function sessions() {
  const { bookings } = await api.get('/bookings'), now = Date.now();
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.starts_at + 3600000 > now).sort((a, b) => a.starts_at - b.starts_at), past = bookings.filter((b) => !upcoming.includes(b));
  const row = (b) => html`<div class="doc"><div class="grow"><div class="row wrap gap-s"><b>${when(b.starts_at)}</b><span class="chip">${b.duration} min</span><span class="st ${b.status === 'completed' ? 'approved' : 'pending'}">${b.status}</span></div>
    <div class="small">${b.as === 'mentor' ? 'Mentee' : 'Mentor'}: <a href="#/profile/${b.other.id}"><b>${b.other.name}</b></a> — ${b.topic || ''}</div></div>
    <div class="row gap-s wrap">${b.status === 'confirmed' && b.starts_at > now ? html`<button class="btn sm danger" data-act="b-cancel" data-id="${b.id}">Cancel</button>` : ''}
    ${b.as === 'mentor' && b.status === 'confirmed' && b.starts_at <= now ? html`<button class="btn sm primary" data-act="b-complete" data-id="${b.id}">Mark complete</button>` : ''}
    ${b.as === 'mentee' && b.status === 'completed' && !b.reviewed ? html`<button class="btn sm primary" data-act="b-review" data-id="${b.id}" data-name="${b.other.name}">Leave review</button>` : ''}
    <a class="btn sm" href="#/messages/${b.other.id}">${icon('msg')}</a></div></div>`;
  return { title: 'My sessions', main: html`${head('My sessions', 'Upcoming and past mentoring sessions.')}${tabs('sessions')}<div class="sect"><span class="label">Upcoming (${upcoming.length})</span></div>${upcoming.length ? upcoming.map(row) : html`<div class="empty">No upcoming sessions. <a href="#/mentors">Find a mentor</a>.</div>`}<div class="sect"><span class="label">Past (${past.length})</span></div>${past.map(row)}` };
}

// ---------- availability (mentors) ----------
actions['slot-del'] = async (el) => { await api.del('/me/slots/' + el.dataset.id); reload(); };
forms.slots = async (f) => {
  const d = formData(f), first = new Date(d.when).getTime(), n = Math.max(1, Math.min(8, Number(d.weeks) || 1));
  await busy(f.querySelector('button'), () => api.post('/me/slots', { starts: Array.from({ length: n }, (_, i) => first + i * 7 * 86400000), duration_min: Number(d.duration) }));
  toast(n > 1 ? `${n} weekly slots published.` : 'Slot published.'); reload();
};
async function availability() {
  if (state.me.role !== 'mentor') return go('/mentors');
  const { slots } = await api.get('/me/slots'), d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0);
  const v = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { title: 'My availability', main: html`${head('My availability', 'Publish time slots. Verified founders and investors can book them instantly.')}${tabs('availability')}
    ${state.me.trust < 1 ? html`<div class="warn" style="margin-bottom:14px">${icon('lock')}<div class="grow"><b>VERIFY TO PUBLISH</b><span class="small">Only verified mentors can publish availability.</span></div><a class="btn sm" href="#/verification">Verify</a></div>` : ''}
    <form class="card brackets" data-form="slots"><div class="form-grid"><label class="field"><span class="label">First slot</span><input type="datetime-local" name="when" value="${v}" required></label><label class="field"><span class="label">Length</span><select name="duration"><option>15</option><option selected>30</option><option>45</option><option>60</option></select></label></div>
    <label class="field"><span class="label">Repeat weekly for</span><select name="weeks">${[1, 2, 3, 4, 6, 8].map((n) => html`<option value="${n}">${n === 1 ? 'Just once' : n + ' weeks'}</option>`)}</select></label><button class="btn primary">${icon('plus')} Publish availability</button></form>
    <div class="sect"><span class="label">Your upcoming slots (${slots.length})</span></div>
    ${slots.length ? slots.map((s) => html`<div class="doc"><div class="grow"><b>${when(s.starts_at)}</b> <span class="chip">${s.duration_min} min</span>${s.status === 'booked' ? html` <span class="st approved">booked by ${s.mentee}</span><div class="small muted">${s.topic}</div>` : html` <span class="st pending">open</span>`}</div>${s.status === 'open' ? html`<button class="btn sm danger" data-act="slot-del" data-id="${s.id}">Remove</button>` : ''}</div>`) : html`<div class="empty">No slots published yet.</div>`}` };
}

// ---------- Q&A ----------
const QD = { tag: '' };
async function qaList() {
  const { questions } = await api.get('/questions' + qs({ tag: QD.tag }));
  return { title: 'Public Q&A', main: html`${head('Public Q&A', 'Ask the community. Verified mentors answer in public so everyone learns.')}${tabs('qa')}
    <div class="row wrap" style="margin-bottom:14px"><select style="width:auto" data-change="qa-tag" aria-label="Filter by topic"><option value="">All topics</option>${state.meta.expertise.map((t) => html`<option ${QD.tag === t ? 'selected' : ''}>${t}</option>`)}</select><button class="btn primary right" data-act="ask">${icon('plus')} Ask a question</button></div>
    ${questions.length ? questions.map((q) => html`<a class="card" href="#/mentors/qa/${q.id}" style="display:block;color:var(--ink);text-decoration:none"><div class="row wrap gap-s"><span class="chip teal">${q.tag || 'General'}</span><span class="tiny muted mono">${q.answers} answer${q.answers === 1 ? '' : 's'}</span><span class="tiny muted right">${ago(q.created_at)}</span></div><h3 style="margin:8px 0 4px;font-size:18px">${q.title}</h3><div class="small muted">${(q.body || '').slice(0, 160)}</div><div class="row gap-s" style="margin-top:10px">${avatar(q.author, 'sm')}<span class="small">${q.author.name}</span></div></a>`) : html`<div class="empty"><h3>No questions yet</h3><p class="muted">Be the first to ask.</p></div>`}` };
}
inputs['qa-tag'] = (el) => { QD.tag = el.value; reload(); };
actions.ask = () => {
  if (!needVerified('ask a question')) return;
  openModal(html`<h2>Ask the community</h2><form data-form="ask"><label class="field"><span class="label">Question</span><input name="title" required minlength="10" maxlength="160" placeholder="e.g. How do I price a B2B pilot?"></label><label class="field"><span class="label">Details (optional)</span><textarea name="body" rows="4" maxlength="1500"></textarea></label><label class="field"><span class="label">Topic</span><select name="tag"><option value="">General</option>${state.meta.expertise.map((t) => html`<option>${t}</option>`)}</select></label><button class="btn primary block">Post question</button></form>`);
};
forms.ask = async (f) => { const r = await busy(f.querySelector('button'), () => api.post('/questions', formData(f))); closeModal(); toast('Question posted.'); go('/mentors/qa/' + r.id); };
actions['q-del'] = async (el) => { if (!confirm('Delete this question?')) return; await api.del('/questions/' + el.dataset.id); toast('Deleted.'); go('/mentors/qa'); };
forms.answer = async (f) => { await busy(f.querySelector('button'), () => api.post(`/questions/${f.dataset.id}/answers`, formData(f))); toast('Answer published.'); reload(); };
async function qaDetail(id) {
  const { question: q, answers } = await api.get('/questions/' + id), me = state.me;
  return { title: q.title, main: html`<a class="small" href="#/mentors/qa">${icon('back')} All questions</a>
    <div class="card brackets" style="margin-top:10px"><div class="row wrap gap-s"><span class="chip teal">${q.tag || 'General'}</span><span class="tiny muted right">${ago(q.created_at)}</span></div><h1 style="font-size:26px;margin:10px 0">${q.title}</h1><div>${nl(q.body)}</div>
      <div class="row" style="margin-top:14px">${avatar(q.author, 'sm')}<a href="#/profile/${q.author.id}"><b>${q.author.name}</b></a>${trustBadge(q.author.trust)}${q.mine || me.is_admin ? html`<button class="btn sm danger right" data-act="q-del" data-id="${q.id}">Delete</button>` : ''}</div></div>
    <div class="sect"><span class="label">${answers.length} answer${answers.length === 1 ? '' : 's'}</span></div>
    ${answers.map((a) => html`<div class="card" style="border-left:6px solid var(--teal)"><div class="row"><a href="#/profile/${a.author.id}">${avatar(a.author, 'sm')}</a><a class="name" href="#/profile/${a.author.id}">${a.author.name}</a>${trustBadge(a.author.trust)}<span class="role">mentor</span><span class="tiny muted right">${ago(a.created_at)}</span></div><div style="margin-top:8px">${nl(a.body)}</div></div>`)}
    ${me.role === 'mentor' && me.trust >= 1 ? html`<form class="card" data-form="answer" data-id="${q.id}"><span class="label">Your answer</span><textarea name="body" rows="5" required minlength="10" maxlength="2000" style="margin:8px 0"></textarea><button class="btn primary">Publish answer</button></form>` : html`<p class="small muted" style="margin-top:12px">Only verified mentors can answer. Know a mentor who can help? Share this question.</p>`}` };
}

export async function mentorsView(p) {
  if (!p.tab) return directory();
  if (p.tab === 'qa') return p.id ? qaDetail(p.id) : qaList();
  if (p.tab === 'sessions') return sessions();
  if (p.tab === 'availability') return availability();
  return directory();
}
