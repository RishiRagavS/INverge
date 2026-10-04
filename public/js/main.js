import { html, esc, state, api, actions, inputs, icon, avatar, trustBadge, toast, debounce, closeModal } from './core.js';
import { barcode } from './halftone.js';
import { go, runLeave, onLeave, refreshMe, updateBadges } from './nav.js';
import { landing, loginView, signupView, forgotView } from './views/auth.js';
import { onboardingView } from './views/onboarding.js';
import { homeView } from './views/feed.js';
import { roomsView, discoverView, alignmentView, networkView } from './views/people.js';
import { mentorsView } from './views/mentors.js';
import { learningView } from './views/learning.js';
import { termsView, privacyView } from './views/legal.js';
import { messagesView } from './views/messages.js';
import { profileView, meView, verificationView, notificationsView, adminView } from './views/me.js';

// [pattern, handler, options]
const routes = [
  ['/terms', termsView, { public: true, bare: true, open: true }], ['/privacy', privacyView, { public: true, bare: true, open: true }],
  ['/', landing, { public: true, bare: true }], ['/login', loginView, { public: true, bare: true }], ['/signup', signupView, { public: true, bare: true }], ['/forgot', forgotView, { public: true, bare: true }],
  ['/onboarding', onboardingView, { bare: true }],
  ['/home', homeView, { nav: '/home' }], ['/rooms', roomsView, { nav: '/rooms' }], ['/discover', discoverView, { nav: '/rooms' }], ['/alignment', alignmentView, { nav: '/rooms' }],
  ['/mentors', mentorsView, { nav: '/rooms' }], ['/mentors/:tab', mentorsView, { nav: '/rooms' }], ['/mentors/:tab/:id', mentorsView, { nav: '/rooms' }],
  ['/learning', learningView, { nav: '/rooms' }], ['/learning/:id', learningView, { nav: '/rooms' }],
  ['/messages', messagesView, { nav: '/messages', wide: true }], ['/messages/:id', messagesView, { nav: '/messages', wide: true }],
  ['/network', networkView, { nav: '/network' }], ['/network/:tab', networkView, { nav: '/network' }],
  ['/profile/:id', profileView, { nav: '/profile' }], ['/me', meView, { nav: '/me' }], ['/me/:tab', meView, { nav: '/me' }],
  ['/verification', verificationView, { nav: '/verification' }], ['/notifications', notificationsView, { nav: '/notifications' }], ['/admin', adminView, { nav: '/admin' }],
].map(([p, h, o]) => ({ re: new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '/?$'), keys: [...p.matchAll(/:(\w+)/g)].map((m) => m[1]), h, o: o || {} }));

const NAV = [['/home', 'home', 'Home'], ['/rooms', 'grid', 'Rooms'], ['/messages', 'msg', 'Messages'], ['/network', 'users', 'Network'], ['/me', 'user', 'Dashboard'], ['/verification', 'shield', 'Verification']];
const TABS = [['/home', 'home', 'Home'], ['/rooms', 'grid', 'Rooms'], ['/messages', 'msg', 'Chat'], ['/network', 'users', 'Network'], ['/me', 'user', 'Me']];

let token = 0, pollTimer = null;
const badge = (k, n) => html`<span class="n ${n ? '' : 'hide'}" data-badge="${k}">${n}</span>`;

function shell(content, { nav, rail, wide }) {
  const me = state.me, un = me.unread, active = (p) => (nav === p ? 'on' : '');
  const demo = html`<div class="demo-strip"><b>DEMO / MVP</b> Fictional sample data · Not financial advice · <a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a></div>`;
  const banner = me.trust < 1 && nav !== '/verification' ? html`<div class="warn" style="margin-bottom:16px"><span class="three"><i></i><i></i><i></i></span>${icon('warn')}<div class="grow"><b>BROWSE-ONLY MODE</b><span class="small">Verify your identity to message, connect, pitch, post and book sessions.</span></div><a class="btn sm" href="#/verification">Verify now</a></div>` : '';
  return html`
  ${demo}<header class="topbar">
    <a class="brand" href="#/home"><span class="sq" aria-hidden="true"></span><span class="w">inverge<em>.</em></span></a>
    <div class="tsearch">${icon('search')}<input type="search" placeholder="Search people & startups" data-input="gsearch" autocomplete="off" aria-label="Search"><div class="results hide" id="sresults"></div></div>
    <div class="right row gap-s">
      <a class="ibtn" href="#/notifications" aria-label="Notifications">${icon('bell')}${badge('notif', un.notifications)}</a>
      <div style="position:relative"><button class="ibtn" data-act="menu" aria-label="Account menu" style="width:auto;padding:0 4px">${avatar(me, 'sm')}</button>
        <div class="menu hide" id="acct">
          <a href="#/me"><span>${icon('user')}</span> Dashboard</a><a href="#/profile/${me.id}"><span>${icon('eye')}</span> Public profile</a><a href="#/verification"><span>${icon('shield')}</span> Verification · ${me.trust_label}</a>
          ${me.is_admin ? html`<a href="#/admin"><span>${icon('lock')}</span> Admin review</a>` : ''}
          <button data-act="logout"><span>${icon('logout')}</span> Log out</button></div></div>
    </div>
  </header>
  <div class="shell">
    <aside class="side"><nav class="nav" aria-label="Primary">
      ${NAV.map(([p, ic, l], i) => html`<a class="${active(p)}" href="#${p}"><small>${String(i + 1).padStart(2, '0')}</small>${icon(ic)}${l}${p === '/messages' ? badge('msg', un.messages) : ''}</a>`)}
      ${me.is_admin ? html`<hr><a class="${active('/admin')}" href="#/admin"><small>AD</small>${icon('lock')}Admin</a>` : ''}
      </nav>
      <div class="panel" style="margin-top:18px;padding:12px"><div class="label">${me.code}</div><div class="row" style="margin:8px 0">${trustBadge(me.trust)}</div>${barcode(me.code)}<div class="tiny muted" style="margin-top:6px">${me.completeness.percent}% profile complete</div></div>
    </aside>
    <main class="main" id="main">${banner}<div class="page ${rail ? 'has-rail' : ''}"><div class="col" style="gap:0;min-width:0">${content}</div>${rail ? html`<aside class="rail">${rail}</aside>` : ''}</div></main>
  </div>
  <nav class="tabbar" aria-label="Mobile">${TABS.map(([p, ic, l]) => html`<a class="${active(p)}" href="#${p}">${icon(ic)}${l}${p === '/messages' ? badge('msg', un.messages) : ''}</a>`)}</nav>`;
}

async function render() {
  const my = ++token;
  runLeave(); closeModal();
  const path = location.hash.slice(1).split('?')[0] || '/';
  let match, params = {};
  for (const r of routes) { const m = r.re.exec(path); if (m) { match = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; } }
  const app = document.getElementById('app');
  if (!match) { location.hash = state.me ? '#/home' : '#/'; return; }
  if (!match.o.public && !state.me) { location.hash = '#/login'; return; }
  if (match.o.public && !match.o.open && state.me && path !== '/') { location.hash = '#/home'; return; }
  if (match.o.public && state.me && path === '/') { location.hash = '#/home'; return; }
  try {
    if (!match.o.bare) app.innerHTML = shell(html`<div class="skeleton"></div><div class="skeleton"></div>`, { nav: match.o.nav }).s;
    const out = await match.h(params, { go, onLeave, query: new URLSearchParams(location.hash.split('?')[1] || '') });
    if (my !== token) return;
    const res = out && out.main ? out : { main: out };
    app.innerHTML = match.o.bare ? res.main.s : shell(res.main, { nav: match.o.nav, rail: res.rail, wide: match.o.wide }).s;
    document.title = (res.title ? res.title + ' · ' : '') + 'INverge';
    window.scrollTo(0, 0);
    await res.after?.();
  } catch (e) {
    if (my !== token) return;
    if (e.status === 401) return;
    const msg = html`<div class="empty"><h2>Something went wrong</h2><p class="muted">${e.message}</p><button class="btn dark" data-act="retry">Try again</button></div>`;
    app.innerHTML = match.o.bare ? msg.s : shell(msg, { nav: match.o.nav }).s;
  }
}

// ---------- global actions ----------
actions.retry = () => render();
actions.menu = (el) => document.getElementById('acct')?.classList.toggle('hide');
actions.logout = async () => { await api.post('/auth/logout'); state.me = null; location.hash = '#/'; toast('Logged out.'); };
document.addEventListener('click', (e) => { if (!e.target.closest('[data-act="menu"]') && !e.target.closest('#acct')) document.getElementById('acct')?.classList.add('hide'); if (!e.target.closest('.tsearch')) document.getElementById('sresults')?.classList.add('hide'); });
inputs.gsearch = debounce(async (el) => {
  const box = document.getElementById('sresults'), q = el.value.trim();
  if (q.length < 2) return box.classList.add('hide');
  const { users } = await api.get('/search?q=' + encodeURIComponent(q));
  box.innerHTML = users.length ? users.map((u) => `<a href="#/profile/${u.id}">${avatar(u, 'sm').s}<div class="grow"><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.startup_name || u.headline || u.role)}</div></div></a>`).join('') : '<div class="small muted" style="padding:12px">No matches</div>';
  box.classList.remove('hide');
}, 250);
// result links navigate through a delegated handler so the dropdown can close first
document.addEventListener('click', (e) => { const a = e.target.closest('#sresults a'); if (a) { e.preventDefault(); document.getElementById('sresults').classList.add('hide'); const i = document.querySelector('.tsearch input'); if (i) i.value = ''; location.hash = a.getAttribute('href'); } });

async function boot() {
  try { state.meta = await api.get('/meta'); } catch { state.meta = { industries: [], stages: [], expertise: [], investor_types: [], doc_kinds: {} }; }
  await refreshMe();
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', debounce(() => { if (['', '#/', '#/login', '#/signup', '#/forgot'].includes(location.hash)) render(); }, 400));
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!state.me || document.hidden) return;
    try { const c = await api.get('/counts'); state.me.unread = c; updateBadges(); } catch { /* ignore */ }
  }, 30000);
  render();
}
boot();
