import { html, raw, state, api, actions, forms, icon, toast, busy, formData, avatar, trustBadge, roleTag, ago, nl, qs, meter } from '../core.js';
import { go, needVerified } from '../nav.js';
import { personMini } from './people.js';

const TYPES = { update: 'Update', funding: 'Funding', call: 'Investor call', insight: 'Mentor insight', learning: 'Learning' };
const FILTERS = [['all', 'All'], ['network', 'My network'], ['funding', 'Funding'], ['call', 'Investor calls'], ['insight', 'Insights'], ['learning', 'Learning'], ['update', 'Updates'], ['saved', 'Saved']];
const FD = { filter: 'all', next: null };

const postCard = (p) => html`<article class="card post" id="post-${p.id}" data-pid="${p.id}">
  <div class="hd"><a href="#/profile/${p.author.id}">${avatar(p.author)}</a>
    <div class="grow"><div class="row wrap gap-s"><a class="name" href="#/profile/${p.author.id}">${p.author.name}</a>${trustBadge(p.author.trust)}</div>
      <div class="small muted">${p.author.startup_name ? p.author.startup_name + ' · ' : ''}${p.author.headline || ''}</div>
      <div class="row gap-s wrap" style="margin-top:6px"><span class="ptype ${p.type}">${TYPES[p.type]}</span>${p.hot ? html`<span class="hot">${icon('flame')}HOT</span>` : ''}<span class="tiny muted mono">${ago(p.created_at)}</span></div></div>
    ${p.mine || state.me.is_admin ? html`<button class="btn ghost sm" data-act="del-post" data-id="${p.id}" aria-label="Delete post" title="Delete">${icon('trash')}</button>` : ''}</div>
  <div class="bd">${nl(p.body)}</div>
  <div class="ft">
    <button class="${p.liked ? 'on' : ''}" data-act="react" data-id="${p.id}" title="Acknowledge">${icon('up')}<b>${p.likes}</b></button>
    <button data-act="comments" data-id="${p.id}" title="Comments">${icon('comment')}<b>${p.comments}</b></button>
    <button data-act="share" data-id="${p.id}" title="Share">${icon('share')}<b>${p.shares}</b></button>
    <button class="${p.saved ? 'on' : ''}" data-act="save-post" data-id="${p.id}" title="Save">${icon('bookmark')}</button></div>
  <div class="comments hide" id="cm-${p.id}"></div></article>`;

async function loadFeed(reset) {
  const list = document.getElementById('feed'), more = document.getElementById('more'); if (!list) return;
  if (reset) { list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; FD.next = null; }
  const r = await api.get('/feed' + qs({ filter: FD.filter, before: reset ? '' : FD.next }));
  if (reset) list.innerHTML = '';
  if (reset && !r.posts.length) list.innerHTML = html`<div class="empty"><h3>Nothing here yet</h3><p class="muted">${FD.filter === 'saved' ? 'Posts you save will appear here.' : FD.filter === 'network' ? 'Connect with members to see their posts here.' : 'Be the first to post in this category.'}</p></div>`.s;
  list.insertAdjacentHTML('beforeend', r.posts.map((p) => postCard(p).s).join(''));
  FD.next = r.next; more.classList.toggle('hide', !r.next);
}

actions['feed-filter'] = (el) => { FD.filter = el.dataset.f; document.querySelectorAll('[data-act=feed-filter]').forEach((b) => b.classList.toggle('on', b === el)); loadFeed(true); };
actions['feed-more'] = () => loadFeed(false);
const bump = (el, r, flag) => { if (flag !== undefined) el.classList.toggle('on', flag); const b = el.querySelector('b'); if (b && r?.count !== undefined) b.textContent = r.count; };
actions.react = async (el) => { const r = await api.post(`/posts/${el.dataset.id}/react`); bump(el, r, r.liked); };
actions['save-post'] = async (el) => { const r = await api.post(`/posts/${el.dataset.id}/save`); bump(el, null, r.saved); toast(r.saved ? 'Saved to your bookmarks.' : 'Removed from saved.'); };
actions.share = async (el) => {
  const card = el.closest('.post'), name = card.querySelector('.name').textContent, text = card.querySelector('.bd').textContent.slice(0, 140);
  const url = location.origin + '/#/profile/' + card.querySelector('.hd a').getAttribute('href').split('/').pop();
  try { if (navigator.share) await navigator.share({ title: 'INverge', text: `${name} on INverge: ${text}`, url }); else { await navigator.clipboard.writeText(`${name} on INverge: "${text}" ${url}`); toast('Copied a shareable summary.'); } } catch { /* cancelled */ }
  bump(el, await api.post(`/posts/${el.dataset.id}/share`));
};
actions['del-post'] = async (el) => { if (!confirm('Delete this post?')) return; await api.del('/posts/' + el.dataset.id); document.getElementById('post-' + el.dataset.id)?.remove(); toast('Post deleted.'); };

const commentHtml = (c) => html`<div class="cm"><a href="#/profile/${c.author.id}">${avatar(c.author, 'sm')}</a><div class="b"><a class="name" style="font-size:13px" href="#/profile/${c.author.id}">${c.author.name}</a> <span class="tiny muted">${ago(c.created_at)}</span><div>${nl(c.body)}</div></div></div>`;
actions.comments = async (el) => {
  const id = el.dataset.id, box = document.getElementById('cm-' + id);
  if (!box.classList.contains('hide')) return box.classList.add('hide');
  box.classList.remove('hide'); box.innerHTML = '<div class="small muted">Loading…</div>';
  const { comments } = await api.get(`/posts/${id}/comments`);
  box.innerHTML = html`<div id="cl-${id}">${comments.map(commentHtml)}${comments.length ? '' : html`<div class="small muted" style="margin-bottom:8px">No comments yet.</div>`}</div>
    <form data-form="comment" data-id="${id}" class="row"><input name="body" placeholder="Add a comment…" maxlength="600" required aria-label="Comment"><button class="btn dark sm">Post</button></form>`.s;
};
forms.comment = async (f) => {
  if (!needVerified('comment')) return;
  const id = f.dataset.id, body = formData(f).body;
  await busy(f.querySelector('button'), () => api.post(`/posts/${id}/comments`, { body }));
  const { comments } = await api.get(`/posts/${id}/comments`);
  document.getElementById('cl-' + id).innerHTML = comments.map((c) => commentHtml(c).s).join(''); f.reset();
  const btn = document.querySelector(`#post-${id} [data-act=comments] b`); if (btn) btn.textContent = comments.length;
};
forms.compose = async (f) => {
  if (!needVerified('post')) return;
  const d = formData(f);
  const { post } = await busy(f.querySelector('button.primary'), () => api.post('/posts', d));
  f.reset(); if (FD.filter === 'all' || FD.filter === 'network' || FD.filter === post.type) { document.getElementById('feed').insertAdjacentHTML('afterbegin', postCard(post).s); document.querySelector('#feed .empty')?.remove(); }
  toast('Posted to the feed.');
};

export function homeView() {
  const me = state.me, types = ['update', 'learning', { founder: 'funding', investor: 'call', mentor: 'insight' }[me.role]];
  FD.filter = 'all';
  const composer = me.trust >= 1
    ? html`<form class="card brackets" data-form="compose" style="margin-bottom:16px"><div class="row" style="align-items:flex-start">${avatar(me)}<div class="grow"><textarea name="body" placeholder="${{ founder: 'Share a milestone or announce your raise…', investor: 'Post an investor call or share what you look for…', mentor: 'Share an insight or tip with founders…' }[me.role]}" maxlength="1500" required minlength="3" style="min-height:70px"></textarea>
      <div class="row wrap" style="margin-top:8px"><select name="type" style="width:auto" aria-label="Post type">${types.map((t) => html`<option value="${t}">${TYPES[t]}</option>`)}</select><button class="btn primary right">Post</button></div></div></div></form>`
    : html`<div class="warn" style="margin-bottom:16px"><span class="three"><i></i><i></i><i></i></span>${icon('lock')}<div class="grow"><b>POSTING LOCKED</b><span class="small">You can read and react now. Verify to post, comment and message.</span></div><a class="btn sm" href="#/verification">Verify</a></div>`;
  const rail = html`
    <div class="card brackets"><div class="row">${avatar(me, 'lg')}<div class="grow"><a class="name" href="#/me">${me.name}</a><div class="small muted">${me.headline || 'Add a headline'}</div><div style="margin-top:6px">${trustBadge(me.trust)}</div></div></div>
      <div class="label" style="margin:14px 0 6px">Profile ${me.completeness.percent}% complete</div>${meter(me.completeness.percent)}
      ${me.completeness.missing.length ? html`<div class="tiny muted" style="margin-top:8px">Next: ${me.completeness.missing.slice(0, 3).join(' · ')}</div>` : ''}<a class="btn sm block" style="margin-top:12px" href="#/me/edit">Improve profile</a></div>
    <div class="card"><div class="row"><span class="label">Top alignments</span><a class="small right" href="#/alignment">See all</a></div><div id="rail-align" class="col" style="margin-top:10px"><div class="skeleton" style="height:56px"></div></div></div>`;
  return {
    title: 'Home', rail,
    main: html`${composer}<div class="tabs" role="tablist">${FILTERS.map(([k, l]) => html`<button class="${k === 'all' ? 'on' : ''}" data-act="feed-filter" data-f="${k}">${l}</button>`)}</div><div id="feed"></div><div class="center" style="margin-top:16px"><button class="btn hide" id="more" data-act="feed-more">Load more</button></div>`,
    after: async () => {
      loadFeed(true);
      try { const { matches } = await api.get('/alignment'); const el = document.getElementById('rail-align'); if (el) el.innerHTML = matches.slice(0, 3).map((m) => personMini(m).s).join('') || '<div class="small muted">Complete your preferences to see matches.</div>'; } catch { /* rail is optional */ }
    },
  };
}
