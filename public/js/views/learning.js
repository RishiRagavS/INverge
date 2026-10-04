import { html, raw, esc, state, api, actions, forms, inputs, icon, toast, busy, formData, qs, ago, debounce, openModal, closeModal } from '../core.js';
import { go, needVerified } from '../nav.js';

const LD = { type: '', q: '' };
const TYPES = [['', 'All'], ['guide', 'Guides'], ['template', 'Templates'], ['video', 'Videos'], ['community', 'Community']];
const KIND = { guide: 'GUIDE', template: 'TEMPLATE', video: 'VIDEO', community: 'COMMUNITY' };

// Minimal, safe markdown: "## heading", "- list", blank-line paragraphs. Everything is escaped.
export function prose(text) {
  const out = []; let list = null;
  const flush = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('## ')) { flush(); out.push(`<h2>${esc(line.slice(3))}</h2>`); }
    else if (line.startsWith('- ')) (list ||= []).push(`<li>${esc(line.slice(2))}</li>`);
    else if (line.trim()) { flush(); out.push(`<p>${esc(line)}</p>`); } else flush();
  }
  flush(); return raw(`<div class="prose">${out.join('')}</div>`);
}

const resCard = (r) => html`<a class="card" href="${r.has_body ? '#/learning/' + r.id : r.url || '#'}" ${!r.has_body && r.url ? raw('target="_blank" rel="noopener noreferrer"') : ''} style="display:flex;flex-direction:column;color:var(--ink);text-decoration:none;min-height:180px">
  <div class="row"><span class="ptype ${r.type === 'guide' ? 'insight' : r.type === 'template' ? 'funding' : 'call'}">${KIND[r.type]}</span><span class="tiny muted right">${ago(r.created_at)}</span></div>
  <h3 style="margin:12px 0 6px;font-size:18px">${r.title}</h3><p class="muted small">${r.summary || ''}</p>
  <div class="row wrap gap-s" style="margin-top:auto">${r.tags.map((t) => html`<span class="chip">${t}</span>`)}<span class="tiny muted right">${r.author_name || ''}${!r.has_body && r.url ? html` · ${icon('link')}` : ''}</span></div></a>`;

async function loadRes() {
  const g = document.getElementById('rgrid'); if (!g) return;
  const { resources } = await api.get('/resources' + qs(LD));
  g.innerHTML = resources.length ? resources.map((r) => resCard(r).s).join('') : html`<div class="empty" style="grid-column:1/-1"><h3>Nothing here yet</h3><p class="muted">Be the first to share a resource in this category.</p></div>`.s;
}
actions['res-type'] = (el) => { LD.type = el.dataset.t; document.querySelectorAll('[data-act=res-type]').forEach((b) => b.classList.toggle('on', b === el)); loadRes(); };
inputs['res-search'] = debounce((el) => { LD.q = el.value.trim(); loadRes(); }, 300);
actions['res-share'] = () => {
  if (!needVerified('share a resource')) return;
  openModal(html`<h2>Share a resource</h2><p class="muted small">Help the community with a useful link, video or short write-up.</p>
    <form data-form="res"><label class="field"><span class="label">Title</span><input name="title" required minlength="5" maxlength="120"></label>
    <div class="form-grid"><label class="field"><span class="label">Type</span><select name="type"><option value="community">Link / write-up</option><option value="video">Video</option></select></label><label class="field"><span class="label">Link (optional for write-ups)</span><input name="url" placeholder="https://"></label></div>
    <label class="field"><span class="label">Short summary</span><input name="summary" maxlength="280"></label><label class="field"><span class="label">Content (optional if you add a link)</span><textarea name="body" rows="4" maxlength="4000"></textarea></label>
    <label class="field"><span class="label">Topics</span><div class="chips">${state.meta.expertise.slice(0, 8).map((t) => html`<label class="chip-toggle"><input type="checkbox" name="tags" value="${t}"><span>${t}</span></label>`)}</div></label><button class="btn primary block">Publish</button></form>`);
};
forms.res = async (f) => { await busy(f.querySelector('button'), () => api.post('/resources', formData(f))); closeModal(); toast('Resource shared. Thank you!'); go('/learning'); };
actions['res-del'] = async (el) => { if (!confirm('Delete this resource?')) return; await api.del('/resources/' + el.dataset.id); toast('Deleted.'); go('/learning'); };

export async function learningView(p) {
  if (p.id) {
    const { resource: r } = await api.get('/resources/' + p.id);
    return { title: r.title, main: html`<a class="small" href="#/learning">${icon('back')} Learning Hub</a><article class="card brackets" style="margin-top:10px;padding:24px"><div class="row wrap"><span class="ptype funding">${KIND[r.type]}</span>${r.tags.map((t) => html`<span class="chip">${t}</span>`)}<span class="tiny muted right">${r.author_name} · ${ago(r.created_at)}</span></div><h1 style="font-size:30px;margin:14px 0 6px">${r.title}</h1><p class="muted">${r.summary}</p>${prose(r.body)}${r.url ? html`<a class="btn primary" target="_blank" rel="noopener noreferrer" href="${r.url}">${icon('link')} Open link</a>` : ''}${r.mine || state.me.is_admin ? html` <button class="btn danger" data-act="res-del" data-id="${r.id}">Delete</button>` : ''}</article>` };
  }
  LD.type = ''; LD.q = '';
  return { title: 'Learning Hub', main: html`<div class="pagehead"><div><div class="label bc">ROOM // 04</div><h1>Learning Hub</h1><p>Pitch templates, investor guides and resources shared by the community.</p></div><button class="btn primary" data-act="res-share">${icon('plus')} Share</button></div>
    <div class="row wrap" style="margin-bottom:14px"><div class="tabs" style="margin:0;border:0;flex:1">${TYPES.map(([k, l]) => html`<button class="${k === '' ? 'on' : ''}" data-act="res-type" data-t="${k}">${l}</button>`)}</div><input style="max-width:240px" placeholder="Search resources" data-input="res-search" aria-label="Search resources"></div><div class="grid2" id="rgrid"></div>`, after: loadRes };
}
