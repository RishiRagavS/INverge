import { html, raw, state, api, actions, forms, inputs, icon, toast, busy, formData, prepareFile } from '../core.js';
import { halftone, barcode } from '../halftone.js';
import { go } from '../nav.js';

export const COUNTRIES = ['Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China', 'Colombia', 'Denmark', 'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Hong Kong', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Rwanda', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Tanzania', 'Thailand', 'Turkey', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Vietnam'];
export const countryList = html`<datalist id="countries">${COUNTRIES.map((c) => html`<option value="${c}">`)}</datalist>`;

const ROLE_INFO = {
  founder: { icon: 'cap', title: 'Founder', text: 'Raise capital, find mentors, and get discovered by investors who back your stage and industry.' },
  investor: { icon: 'target', title: 'Investor', text: 'Discover verified startups that match your thesis, ticket size and stage — with a trust badge on every profile.' },
  mentor: { icon: 'book', title: 'Mentor', text: 'Share your experience, publish availability, answer questions publicly and build a reputation through reviews.' },
};

function authLayout(inner, { quote = 'Trust is the shortest path between capital and craft.' } = {}) {
  return html`<div class="authwrap">
    <aside class="authart"><canvas id="authcanvas"></canvas>
      <a class="brand" href="#/" style="color:#e9f2f1"><span class="sq" style="background:var(--teal-l);color:var(--ink)" aria-hidden="true"></span>inverge<em>.</em></a>
      <div><div class="label" style="color:var(--teal-l)">// NETWORK #0001</div><p style="font:700 clamp(22px,2.6vw,34px)/1.15 var(--mono);letter-spacing:-.03em;max-width:18ch;margin-top:10px">${quote}</p></div>
      <div style="width:200px;opacity:.9">${barcode('inverge-auth', { color: '#e9f2f1' })}</div></aside>
    <section class="authform">${inner}</section></div>`;
}
const drawAuthArt = () => { const c = document.getElementById('authcanvas'); if (c) halftone(c, { seed: 21, spacing: 8, color: '#38cfc3', nodes: 9 }); };

// ======================= LANDING =======================
export function landing() {
  const tier = (n, t, lvl, items, on) => html`<div class="tier"><div class="row"><span class="big">${n}</span><span class="trust t${lvl}">${icon('shield')}${t}</span></div><div class="meter" style="margin:12px 0">${Array.from({ length: 3 }, (_, i) => html`<i class="${i < lvl ? 'on' : ''}"></i>`)}</div><ul class="small" style="padding-left:18px;margin:0">${items.map((i) => html`<li>${i}</li>`)}</ul></div>`;
  return {
    title: 'Trust-first network',
    main: html`<div class="land">
      <nav class="lnav"><a class="brand" href="#/" style="font-size:26px"><span class="sq" style="width:28px;height:28px" aria-hidden="true"></span>inverge<em>.</em></a>
        <div class="links"><a href="#roles">founders.</a><a href="#trust">verified.</a><a href="#rooms">mentors.</a></div>
        <a class="btn ghost" href="#/login">Log in</a><a class="btn dark" href="#/signup">Create account</a></nav>
      <section class="hero"><div>
        <div class="label">PROJECT #0001 — TRUST-FIRST NETWORK</div>
        <h1 style="margin-top:14px">Where <em>verified</em> founders meet capital & craft.</h1>
        <p class="sub">INverge is a professional network for startup founders, investors and mentors. Members can submit ID and profile checks for review, every match is explained, and every conversation starts with transparency. Badges show checks completed, not guarantees.</p>
        <div class="row wrap"><a class="btn primary lg" href="#/signup">Join INverge — it's free</a><a class="btn lg" href="#/login">I have an account</a></div>
        <div class="row wrap" style="margin-top:26px;gap:22px"><div><div class="mono" style="font-weight:800;font-size:22px">3</div><div class="label">member roles</div></div><div><div class="mono" style="font-weight:800;font-size:22px">3</div><div class="label">trust tiers</div></div><div><div class="mono" style="font-weight:800;font-size:22px">100%</div><div class="label">explained matches</div></div></div>
      </div>
      <div class="art brackets"><canvas id="heroart"></canvas>
        <div class="frame"><div>Project code: INV-2026</div><div style="margin-top:6px;font-weight:700">ALIGNMENT SCAN</div><div style="margin-top:6px;color:var(--teal-d)">Industry ▪ Stage ▪ Ticket ▪ Region</div><div class="meter" style="margin-top:10px"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></div></div>
        <div class="wstrip warn">${icon('warn')}<div><b>VERIFY</b><span class="tiny">Identity first. Always.</span></div></div>
        <div class="tag" style="left:5%;top:5%">design. / network. / trust.</div><div class="tag" style="right:5%;bottom:5%">/// 2026</div></div></section>

      <section id="roles" class="stack"><div class="sect"><span class="label">01 // Three roles. One network.</span></div>
        <div class="triple">${Object.entries(ROLE_INFO).map(([k, r]) => html`<div class="card brackets"><div class="rolecard" style="border:0;padding:0;background:none;cursor:default"><div class="ic">${icon(r.icon)}</div><div><b>${r.title}</b><div class="label">${k === 'founder' ? 'FND-0001' : k === 'investor' ? 'INV-0001' : 'MNT-0001'}</div></div></div><p style="margin-top:12px">${r.text}</p></div>`)}</div></section>

      <section id="trust"><div class="sect"><span class="label">02 // Trust you can see</span></div>
        <div class="triple">
          ${tier('Basic', 'Basic', 1, ['Email verified with one-time code', 'Government ID uploaded', 'LinkedIn profile linked', 'Unlocks messaging, connecting, pitching, booking'])}
          ${tier('Gold', 'Gold', 2, ['Documents reviewed by the INverge team', 'Business, investment or experience proof approved', 'Gold badge on every card and profile'])}
          ${tier('Elite', 'Elite', 3, ['Earned through real community activity', 'Active connections, posts and answers', 'Priority placement in alignment results'])}</div></section>

      <section id="rooms"><div class="sect"><span class="label">03 // Four rooms</span></div>
        <div class="grid2">${[['compass', 'Discover', 'Search and filter verified founders, investors and mentors by industry, stage and region.'], ['target', 'Alignment', 'Rule-based matches with a plain-English "why you align" — no black box.'], ['cap', 'Mentor’s Room', 'Browse mentors, book sessions, ask public questions and leave reviews.'], ['book', 'Learning Hub', 'Pitch templates, investor guides and community-shared resources.']].map(([i, t, d], n) => html`<div class="panel"><div class="row"><span class="label">ROOM 0${n + 1}</span><span class="right">${icon(i)}</span></div><h3 style="margin:8px 0 4px;font-size:20px">${t}</h3><p class="muted" style="margin:0">${d}</p></div>`)}</div></section>

      <section style="margin-top:40px"><div class="card dots" style="background-color:var(--ink);color:#e9f2f1;text-align:center;padding:40px 20px;background-image:radial-gradient(rgba(56,207,195,.35) 1.2px,transparent 1.4px);background-size:9px 9px"><h2 style="font-size:clamp(24px,4vw,40px)">Ready to build with people you can trust?</h2><p style="margin:10px auto 20px;max-width:46ch;color:#b8cfcd">Create your free account in minutes. Browse instantly, unlock everything once you are verified.</p><a class="btn primary lg" href="#/signup">Create your account</a></div></section>
      <footer class="lfoot"><span>@inverge · <a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a></span><div style="width:180px">${barcode('inverge-footer')}</div><span>DEMO / MVP · sample data is fictional · not investment advice</span></footer></div>`,
    after: () => { const c = document.getElementById('heroart'); if (c) halftone(c, { seed: 11, spacing: 8, color: '#0b7d79', nodes: 11 }); },
  };
}

// ======================= OTP (shared) =======================
const otpBox = (email, demo, mode) => html`
  <h2 style="font-size:24px">Check your email</h2><p class="muted">We sent a 6-digit code to <b>${email}</b>. It expires in 10 minutes.</p>
  ${demo ? html`<div class="warn" style="margin:12px 0"><span class="three"><i></i><i></i><i></i></span>${icon('warn')}<div class="grow"><b>DEMO MODE</b><span class="small">Email delivery is not configured on this server, so your code is: <b class="mono" style="font-size:16px">${demo}</b></span></div><button class="btn sm" data-act="fill-otp" data-code="${demo}">Autofill</button></div>` : ''}
  <form data-form="otp-${mode}" autocomplete="off"><label class="field"><span class="label">Verification code</span><input class="otp" name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="••••••" required autofocus></label>
  <button class="btn primary block lg">Verify & continue</button></form>
  <p class="small muted center" style="margin-top:14px">Didn't get it? <a href="#" data-act="resend-otp" data-mode="${mode}">Resend code</a></p>`;
actions['fill-otp'] = (el) => { const i = document.querySelector('input[name=code]'); if (i) i.value = el.dataset.code; };

async function finishOtp(f, email) {
  const { code } = formData(f);
  const r = await busy(f.querySelector('button.primary'), () => api.post('/auth/verify-otp', { email, code }));
  state.me = r.user;
  if (S.avatar) { try { const up = await api.post('/files', { kind: 'avatar', ...S.avatar }); await api.put('/me', { avatar_file_id: up.id }); } catch { toast('Account created — you can add your photo later.', true); } }
  S.avatar = null; await (await import('../nav.js')).refreshMe();
  toast('Email verified. Welcome to INverge!'); go(state.me.onboarding_step < 6 ? '/onboarding' : '/home');
}
actions['resend-otp'] = async (el) => {
  const email = el.dataset.mode === 'login' ? L.email : S.email;
  const r = await api.post('/auth/resend-otp', { email });
  if (el.dataset.mode === 'login') L.demo = r.demo_otp || null; else S.demo = r.demo_otp || null;
  toast('A new code is on its way.'); (el.dataset.mode === 'login' ? renderLogin : renderSignup)();
};

// ======================= LOGIN =======================
const L = { mode: 'form', email: '', demo: null };
const renderLogin = () => {
  const box = document.getElementById('li'); if (!box) return;
  box.innerHTML = (L.mode === 'otp' ? otpBox(L.email, L.demo, 'login') : html`
    <div class="label">WELCOME BACK</div><h2 style="font-size:28px;margin:6px 0 18px">Log in to INverge</h2>
    <form data-form="login"><label class="field"><span class="label">Email</span><input type="email" name="email" autocomplete="email" required autofocus></label>
    <label class="field"><span class="label">Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn primary block lg">Log in</button></form>
    <p class="small" style="margin-top:14px"><a href="#/forgot">Forgot password?</a></p>
    <hr style="border:0;border-top:1px dashed var(--ink);margin:18px 0"><p class="small muted center">New here? <a href="#/signup"><b>Create an account</b></a></p>`).s;
};
forms.login = async (f) => {
  const d = formData(f);
  try { const r = await busy(f.querySelector('button'), () => api.post('/auth/login', d)); state.me = r.user; go(r.user.onboarding_step < 6 ? '/onboarding' : '/home'); }
  catch (e) { if (e.data?.needs_verification) { L.mode = 'otp'; L.email = e.data.email; L.demo = e.data.demo_otp || null; renderLogin(); } }
};
forms['otp-login'] = (f) => finishOtp(f, L.email);
export function loginView() { L.mode = 'form'; return { title: 'Log in', main: authLayout(html`<div class="card brackets" id="li"></div>`), after: () => { drawAuthArt(); renderLogin(); } }; }

// ======================= SIGNUP =======================
const S = { step: 1, role: null, email: '', demo: null, avatar: null, v: {} };
const stepper = (n) => html`<div class="steps">${['Role', 'Details', 'Verify email'].map((t, i) => html`<div class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}">0${i + 1} ${t}</div>`)}</div>`;
const renderSignup = () => {
  const box = document.getElementById('su'); if (!box) return;
  const v = S.v;
  if (S.step === 1) box.innerHTML = html`${stepper(1)}<h2 style="font-size:26px;margin-bottom:4px">How will you use INverge?</h2><p class="muted">Pick the role that fits you best.</p>
    ${Object.entries(ROLE_INFO).map(([k, r]) => html`<button type="button" class="rolecard ${S.role === k ? 'on' : ''}" data-act="pick-role" data-role="${k}"><div class="ic">${icon(r.icon)}</div><div><b>${r.title}</b><div class="small muted" style="margin-top:3px;padding-right:60px">${r.text}</div></div></button>`)}
    <div class="warn" style="margin:12px 0"><span class="three"><i></i><i></i><i></i></span>${icon('lock')}<div><b>ROLE IS PERMANENT</b><span class="small">Your role shapes your profile, matches and permissions, and can't be changed later.</span></div></div>
    <button class="btn primary block lg ${S.role ? '' : 'off'}" data-act="signup-next">Continue</button><p class="small muted center" style="margin-top:14px">Already a member? <a href="#/login"><b>Log in</b></a></p>`.s;
  else if (S.step === 2) box.innerHTML = html`${stepper(2)}<h2 style="font-size:26px;margin-bottom:14px">Create your ${S.role} account</h2>
    <form data-form="signup"><div class="form-grid">
      <label class="field"><span class="label">Full name</span><input name="name" value="${v.name || ''}" required minlength="2" autocomplete="name"></label>
      <label class="field"><span class="label">Email</span><input type="email" name="email" value="${v.email || ''}" required autocomplete="email"></label>
      <label class="field"><span class="label">Password</span><input type="password" name="password" required minlength="10" autocomplete="new-password"><span class="hint">10+ characters, with a letter and a number.</span></label>
      <label class="field"><span class="label">Country</span><input name="country" list="countries" value="${v.country || ''}" required autocomplete="country-name"></label>
      <label class="field"><span class="label">City</span><input name="city" value="${v.city || ''}" required autocomplete="address-level2"></label>
      <label class="field"><span class="label">Profile photo (optional)</span><input type="file" accept="image/*" data-change="signup-photo"><span class="hint" id="photohint">${S.avatar ? 'Photo ready ✓' : 'Square crop, resized automatically.'}</span></label></div>
    ${countryList}<label class="chk"><input type="checkbox" name="accept_terms" required><span>I am 18 or over and agree to the <a href="#/terms" target="_blank">Terms of Use</a> and <a href="#/privacy" target="_blank">Privacy Notice</a>. I understand INverge is not investment, legal or financial advice.</span></label><p class="small muted">We'll email you a one-time code to verify your address.</p>
    <div class="row"><button type="button" class="btn" data-act="signup-back">Back</button><button class="btn primary grow lg">Send verification code</button></div></form>`.s;
  else box.innerHTML = html`${stepper(3)}${otpBox(S.email, S.demo, 'signup')}`.s;
};
actions['pick-role'] = (el) => { S.role = el.dataset.role; renderSignup(); };
actions['signup-next'] = () => { if (S.role) { S.step = 2; renderSignup(); } };
actions['signup-back'] = () => { S.step = 1; renderSignup(); };
inputs['signup-photo'] = async (el) => { try { S.avatar = await prepareFile(el.files[0], { avatar: true }); document.getElementById('photohint').textContent = 'Photo ready ✓'; } catch (e) { toast(e.message, true); } };
forms.signup = async (f) => {
  const d = formData(f); S.v = { name: d.name, email: d.email, country: d.country, city: d.city };
  const r = await busy(f.querySelector('button.primary'), () => api.post('/auth/register', { ...d, role: S.role }));
  S.email = r.email; S.demo = r.demo_otp || null; S.step = 3; renderSignup();
};
forms['otp-signup'] = (f) => finishOtp(f, S.email);
export function signupView() { S.step = 1; S.role = null; S.v = {}; S.avatar = null; return { title: 'Create account', main: authLayout(html`<div class="card brackets" id="su"></div>`, { quote: 'Checked profiles. Explained matches. Real conversations.' }), after: () => { drawAuthArt(); renderSignup(); } }; }

// ======================= FORGOT =======================
const F = { step: 1, email: '', demo: null };
const renderForgot = () => {
  const box = document.getElementById('fg'); if (!box) return;
  box.innerHTML = (F.step === 1 ? html`<div class="label">ACCOUNT RECOVERY</div><h2 style="font-size:26px;margin:6px 0 4px">Reset your password</h2><p class="muted">Enter your email and we'll send a one-time code.</p>
    <form data-form="forgot"><label class="field"><span class="label">Email</span><input type="email" name="email" required autofocus></label><button class="btn primary block lg">Send code</button></form><p class="small center" style="margin-top:14px"><a href="#/login">Back to log in</a></p>`
    : html`<div class="label">ACCOUNT RECOVERY</div><h2 style="font-size:26px;margin:6px 0 4px">Choose a new password</h2><p class="muted">If an account exists for <b>${F.email}</b>, a code is on its way.</p>
    ${F.demo ? html`<div class="warn" style="margin:12px 0">${icon('warn')}<div class="grow"><b>DEMO MODE</b><span class="small">Your code: <b class="mono">${F.demo}</b></span></div><button class="btn sm" data-act="fill-otp" data-code="${F.demo}">Autofill</button></div>` : ''}
    <form data-form="reset"><label class="field"><span class="label">Code</span><input class="otp" name="code" inputmode="numeric" maxlength="6" required></label><label class="field"><span class="label">New password</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn primary block lg">Update password</button></form>`).s;
};
forms.forgot = async (f) => { const d = formData(f); const r = await busy(f.querySelector('button'), () => api.post('/auth/forgot', d)); F.email = r.email; F.demo = r.demo_otp || null; F.step = 2; renderForgot(); };
forms.reset = async (f) => { await busy(f.querySelector('button'), () => api.post('/auth/reset', { email: F.email, ...formData(f) })); toast('Password updated. Please log in.'); go('/login'); };
export function forgotView() { F.step = 1; return { title: 'Reset password', main: authLayout(html`<div class="card brackets" id="fg"></div>`), after: () => { drawAuthArt(); renderForgot(); } }; }
