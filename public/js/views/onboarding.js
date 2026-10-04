import { html, raw, state, api, actions, forms, inputs, icon, toast, busy, formData, prepareFile, avatar, meter, trustBadge } from '../core.js';
import { go, refreshMe } from '../nav.js';

const O = { step: 3, docs: [], draft: {} };

export const chipGroup = (name, options, selected = [], type = 'checkbox') =>
  html`<div class="chips">${options.map((o) => html`<label class="chip-toggle"><input type="${type}" name="${name}" value="${o}" ${selected.includes(o) ? 'checked' : ''}><span>${o}</span></label>`)}</div>`;

export const docSlot = (kind, label, hint, docs, { required = false } = {}) => {
  const d = docs.find((x) => x.kind === kind);
  return html`<div class="doc"><div class="grow"><b>${label}</b> ${required ? html`<span class="tiny muted">(required for Basic)</span>` : html`<span class="tiny muted">(optional)</span>`}<div class="hint">${hint}</div>
    ${d ? html`<div class="small" style="margin-top:4px">${icon('file')} ${d.name} · <span class="st ${d.status}">${d.status}</span>${d.note ? html` — ${d.note}` : ''}</div>` : ''}
    <input type="file" style="margin-top:8px" accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.docx,image/*" data-change="doc-upload" data-kind="${kind}"></div></div>`;
};
inputs['doc-upload'] = async (el) => {
  const file = el.files[0]; if (!file) return;
  const kind = el.dataset.kind;
  try {
    const up = await prepareFile(file);
    const r = await api.post('/me/documents', { kind, ...up });
    toast(r.trust >= 1 ? `Uploaded — your ${['', 'Basic', 'Gold', 'Elite'][r.trust]} badge is active.` : 'Uploaded ✓ Press “Save & continue” to apply your LinkedIn link and unlock Basic.');
    await refreshMe();
    const f3 = document.querySelector('form[data-form=onb3]'); if (f3) O.draft = Object.fromEntries(new FormData(f3));
    if (document.getElementById('onb')) renderOnb(); else go(location.hash.slice(1).split('?')[0] || '/verification');
  } catch (e) { toast(e.message, true); el.value = ''; }
};

const header = (n) => html`<div class="steps">${['Role', 'Email', 'Verify', 'Preferences', 'Profile'].map((t, i) => html`<div class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}">0${i + 1} ${t}</div>`)}</div>`;

async function renderOnb() {
  const box = document.getElementById('onb'); if (!box) return;
  const me = state.me, m = state.meta;
  if (O.step === 3) {
    O.docs = (await api.get('/me/documents')).documents;
    const proof = { founder: [['registration', 'Business registration proof', 'Company registration or incorporation document.'], ['pitch_deck', 'Pitch deck', 'PDF or PPTX under 1 MB. You can choose to share it with verified investors from the Verification Center.']], investor: [['investment_proof', 'Investment license or proof', 'License, fund registration, or evidence of past investments.']], mentor: [['resume', 'Resume or experience proof', 'PDF or DOCX under 1 MB.']] }[me.role];
    box.innerHTML = html`${header(3)}
      <div class="row wrap"><h2 style="font-size:26px">Verify your identity</h2><span class="right">${trustBadge(me.trust)}</span></div>
      <p class="muted">Verified members can message, connect, pitch and book sessions. Unverified accounts are browse-only. You can also do this later.</p>
      <form data-form="onb3">
        <div class="form-grid">
          <label class="field"><span class="label">LinkedIn profile URL</span><input name="linkedin_url" placeholder="linkedin.com/in/yourname" value="${O.draft.linkedin_url ?? me.linkedin_url ?? ''}" required></label>
          ${me.role === 'founder' ? html`<label class="field"><span class="label">Startup name</span><input name="startup_name" value="${O.draft.startup_name ?? me.startup_name ?? ''}" required maxlength="80"></label>` : ''}
          ${me.role === 'investor' ? html`<label class="field"><span class="label">Investor type</span><select name="investor_type" required><option value="">Select…</option>${m.investor_types.map((t) => html`<option ${(O.draft.investor_type ?? me.investor_type) === t ? 'selected' : ''}>${t}</option>`)}</select></label>
            <label class="field"><span class="label">Typical cheque (USD)</span><div class="row"><input type="number" name="ticket_min" min="0" placeholder="Min" value="${O.draft.ticket_min ?? me.ticket_min ?? ''}"><input type="number" name="ticket_max" min="0" placeholder="Max" value="${O.draft.ticket_max ?? me.ticket_max ?? ''}"></div></label>` : ''}
          ${me.role === 'mentor' ? html`<label class="field"><span class="label">Years of experience</span><input type="number" name="years_exp" min="0" max="60" value="${O.draft.years_exp ?? me.years_exp ?? ''}" required></label>` : ''}
        </div>
        <div class="sect"><span class="label">Documents</span></div>
        ${docSlot('gov_id', 'Government ID', 'Passport, driving licence or national ID (e.g. Aadhaar). JPG, PNG or PDF, under 1 MB.', O.docs, { required: true })}
        ${proof.map(([k, l, h]) => docSlot(k, l, h, O.docs))}
        <div class="row" style="margin-top:16px"><button type="button" class="btn ghost" data-act="onb-skip">Skip — browse only for now</button><button class="btn primary right lg">Save & continue</button></div>
      </form>`.s;
  } else if (O.step === 4) {
    const sel = (s) => (s || '').toString().split(',').filter(Boolean);
    box.innerHTML = html`${header(4)}<h2 style="font-size:26px">Your preferences</h2><p class="muted">These power your Alignment matches. Pick what genuinely fits.</p>
      <form data-form="onb4">
        <div class="field"><span class="label">Industries of interest (up to 8)</span>${chipGroup('industries', m.industries, me.industries)}</div>
        ${me.role === 'founder' ? html`<div class="field"><span class="label">Current stage</span>${chipGroup('stages', m.stages, me.stages, 'radio')}</div>
          <div class="form-grid"><label class="field"><span class="label">Funding goal (USD)</span><input type="number" name="funding_goal" min="0" value="${me.funding_goal ?? ''}"></label><label class="field"><span class="label">Traction (one line)</span><input name="traction" maxlength="500" value="${me.traction || ''}" placeholder="e.g. 12 pilots · 40k users"></label></div>` : ''}
        ${me.role === 'investor' ? html`<div class="field"><span class="label">Stages you invest in</span>${chipGroup('stages', m.stages, me.stages)}</div>` : ''}
        ${me.role === 'mentor' ? html`<div class="field"><span class="label">Areas you mentor in (up to 6)</span>${chipGroup('expertise', m.expertise, me.expertise)}</div><div class="field"><span class="label">Stages you mentor</span>${chipGroup('stages', m.stages, me.stages)}</div>` : ''}
        <div class="field"><span class="label">Notifications</span><div class="col gap-s">${[['requests', 'Connection requests'], ['alignments', 'New alignments'], ['messages', 'Messages'], ['bookings', 'Booking updates']].map(([k, l]) => html`<label class="row"><input type="checkbox" name="np_${k}" ${me.notif_prefs[k] !== false ? 'checked' : ''}> ${l}</label>`)}</div></div>
        <div class="row"><button type="button" class="btn" data-act="onb-back">Back</button><button class="btn primary right lg">Continue</button></div>
      </form>`.s;
  } else {
    box.innerHTML = html`${header(5)}<h2 style="font-size:26px">Tell your story</h2><p class="muted">A clear headline and bio get you noticed in Discover and Alignment.</p>
      <div class="row" style="margin-bottom:14px">${avatar(me, 'lg')}<label class="field" style="margin:0"><span class="label">Profile photo</span><input type="file" accept="image/*" data-change="onb-photo"></label></div>
      <form data-form="onb5"><label class="field"><span class="label">Headline</span><input name="headline" maxlength="120" required value="${me.headline || ''}" placeholder="${{ founder: 'e.g. Building AI triage for rural clinics', investor: 'e.g. Partner at Lotus Seed Fund · health & fintech', mentor: 'e.g. Two-time founder · product & fundraising' }[me.role]}"></label>
      <label class="field"><span class="label">About you</span><textarea name="bio" rows="5" maxlength="1200" required minlength="30">${me.bio || ''}</textarea><span class="hint">At least 30 characters. What do you do, and what are you looking for?</span></label>
      <div class="field"><span class="label">Profile completeness · ${me.completeness.percent}%</span>${meter(me.completeness.percent)}</div>
      <div class="row"><button type="button" class="btn" data-act="onb-back">Back</button><button class="btn primary right lg">Finish & enter INverge</button></div></form>`.s;
  }
}

const step = async (n) => { O.step = n; await api.put('/me/onboarding', { step: n }); renderOnb(); };
actions['onb-skip'] = async () => { await api.put('/me/onboarding', { step: 4 }); O.step = 4; renderOnb(); };
actions['onb-back'] = () => { O.step = Math.max(3, O.step - 1); renderOnb(); };
forms.onb3 = async (f) => {
  const d = formData(f), body = { linkedin_url: d.linkedin_url };
  for (const k of ['startup_name', 'investor_type', 'ticket_min', 'ticket_max', 'years_exp']) if (k in d) body[k] = d[k];
  await busy(f.querySelector('button.primary'), async () => { state.me = (await api.put('/me', body)).user; });
  if (state.me.trust < 1) toast('Saved. Upload your ID to unlock the Basic badge — you can do it anytime.');
  await step(4);
};
forms.onb4 = async (f) => {
  const d = formData(f), me = state.me, arr = (v) => [].concat(v || []);
  const body = { industries: arr(d.industries), notif_prefs: Object.fromEntries(['requests', 'alignments', 'messages', 'bookings'].map((k) => [k, !!d['np_' + k]])) };
  if (me.role === 'founder') Object.assign(body, { stages: arr(d.stages).slice(0, 1), funding_goal: d.funding_goal, traction: d.traction });
  if (me.role === 'investor') body.stages = arr(d.stages);
  if (me.role === 'mentor') Object.assign(body, { stages: arr(d.stages), expertise: arr(d.expertise) });
  await busy(f.querySelector('button.primary'), async () => { state.me = (await api.put('/me', body)).user; });
  await step(5);
};
inputs['onb-photo'] = async (el) => {
  try { const up = await api.post('/files', { kind: 'avatar', ...(await prepareFile(el.files[0], { avatar: true })) }); state.me = (await api.put('/me', { avatar_file_id: up.id })).user; renderOnb(); } catch (e) { toast(e.message, true); }
};
forms.onb5 = async (f) => {
  await busy(f.querySelector('button.primary'), async () => { state.me = (await api.put('/me', formData(f))).user; await api.put('/me/onboarding', { step: 6 }); });
  await refreshMe(); toast('You are all set. Welcome aboard!'); go('/home');
};

export function onboardingView() {
  O.step = Math.min(5, Math.max(3, state.me.onboarding_step || 3)); O.draft = {};
  if (state.me.onboarding_step >= 6) { go('/home'); return html``; }
  return { title: 'Set up your profile', main: html`<div style="min-height:100vh;padding:24px 14px;display:flex;flex-direction:column;align-items:center"><a class="brand" href="#/home" style="margin-bottom:18px"><span class="sq" aria-hidden="true"></span>inverge<em>.</em></a><div class="card brackets" style="width:100%;max-width:760px;padding:26px" id="onb"></div></div>`, after: renderOnb };
}
