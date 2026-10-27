import { POLL_MS } from './config.js';
import { db } from './data.js';
import { checkLive, videoId } from './youtube.js';
import { TIERS, esc, safeUrl, paragraphs } from './util.js';
import { applySite } from './site.js';
import { initTheme } from './theme.js';

const app = document.getElementById('app');
let timer, onLive = null, serverLive = null;
const SCAN_MS = 5 * 60000; // interval jadwal GitHub Actions
const dn = m => m.ytName || m.name; // nama tampil di kartu live: nama channel YouTube
const fmt = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
const fresh = d => (d && Date.now() - d.updatedAt < 20 * 60000 ? d : null);
db.listen('live', 'status', d => { serverLive = d; if (onLive) onLive(); }).catch(() => {});

const card = m => {
  const href = safeUrl(m.live ? m.videoUrl || m.channelUrl : m.channelUrl);
  return `<a class="card ${m.live ? 'live' : ''}" href="${esc(href)}" target="_blank" rel="noopener">
    <div class="av">${m.avatar ? `<img src="${esc(safeUrl(m.avatar))}" alt="">` : esc(m.name[0])}</div>
    <h3>${esc(m.name)}</h3><div class="muted">${esc(m.title || m.tier)}</div>
    <span class="badge">${m.live ? 'Live' + (m.viewers ? ' · ' + esc(m.viewers) + ' nonton' : '') : 'Offline'}</span></a>`;
};

async function withStatus(members) {
  const st = await checkLive(members), sv = fresh(serverLive);
  return members.map(m => {
    // Member yang punya link channel dan dikenali server: pakai hasil deteksi otomatis
    if (sv && m.channelUrl && !(sv.untracked || []).includes(m.id)) {
      const it = sv.items && sv.items[m.id];
      return it ? { ...m, ...it, live: true } : { ...m, live: false };
    }
    return { ...m, ...(st[m.id] || { live: !!m.manualLive }) };
  });
}

const ago = iso => {
  const t = Date.parse(iso); if (!t) return '';
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' j ' + (m % 60) + ' m';
};
const ico = d => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const EYE = ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const CLOCK = ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const meta = m => (m.viewers ? `<span class="mi" title="Penonton">${EYE}${esc(m.viewers)}</span>` : '') + (m.startedAt ? `<span class="mi" title="Sudah live">${CLOCK}<span data-since="${esc(m.startedAt)}">${ago(m.startedAt)}</span></span>` : '');
const avatar = m => m.avatar ? `<img src="${esc(safeUrl(m.avatar))}" alt="">` : esc(dn(m)[0]);

const liveCard = m => {
  const id = videoId(m.videoUrl), href = esc(safeUrl(m.videoUrl || m.channelUrl));
  return `<a class="lcard" href="${href}" target="_blank" rel="noopener">
    <div class="thumb">${id ? `<img src="${esc(m.thumb || `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`)}" alt="" loading="lazy">` : '<span class="bolt-bg">BTS</span>'}
      <span class="badge live">Live</span>
      <div class="ov"><h3>${esc(dn(m))}</h3></div></div>
    ${m.liveTitle ? `<p class="ltitle">${esc(m.liveTitle)}</p>` : ''}
    <div class="act">${meta(m)}<span class="go">Tonton ›</span></div></a>`;
};

async function home() {
  const [members, allPosts] = await Promise.all([db.list('members'), db.list('posts')]);
  const posts = allPosts.slice(0, 3);
  app.innerHTML = `<div class="herowrap"><span class="hc tl"></span><span class="hc tr"></span><span class="hc bl"></span><span class="hc br"></span><section class="hero"><div class="hmain"><p class="eyebrow">Banana Thunder Street</p>
    <h1>Pantau Anak BTS yang <mark>lagi live.</mark></h1>
    <p class="lead">Klik kartu live untuk menonton langsung di YouTube.</p>
    <div class="hcta"><a class="btn" href="#/struktur">Lihat struktur</a><a class="btn ghost" href="#/blog">Baca blog</a></div>
    <div class="hmeta"><div><b>${members.length}</b><span>terdaftar</span></div><div><b id="mview">0</b><span>penonton</span></div><div><b class="mono" id="scan"></b><span>Auto scan</span></div></div></div>
    <div class="hstat"><span class="hlabel"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Live sekarang</span>
      <div class="hnum"><b id="n">0</b><span>anggota</span></div><div class="stack" id="stack"></div></div>
    <div class="ticker" id="ticker" aria-live="polite"></div></section></div>
    <div class="search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="q" type="search" placeholder="Cari member, judul stream..." autocomplete="off" aria-label="Cari live"></div>
    <div class="tools">
      <div class="sel" id="tierwrap"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/></svg><select id="tier" aria-label="Filter tier"></select></div>
      <div class="sel"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg><select id="sort" aria-label="Urutkan"><option value="views">Penonton terbanyak</option><option value="new">Baru mulai</option><option value="name">Nama A-Z</option></select></div></div>
    <div class="sechead"><h2>Sedang live</h2><span class="chip" id="count"></span></div>
    <div id="liveGrid" class="lgrid"></div><div id="pager" class="pager"></div>
    <div class="sechead"><h2>Kabar terbaru</h2><a class="more" href="#/blog">Semua tulisan ›</a></div>
    <div class="news">${posts.length ? posts.map(p => `<a class="post" href="#/blog/${esc(p.id)}"><span class="muted">${esc(p.date)}</span><h3>${esc(p.title)}</h3><p>${esc((p.body || '').slice(0, 100))}…</p></a>`).join('') : '<p class="muted">Belum ada tulisan.</p>'}</div>
    <a class="cta" href="#/struktur"><div><h3>Struktur organisasi</h3><p>Lihat bagan jabatan BTS dari pimpinan sampai anggota.</p></div><span class="btn">Lihat bagan</span></a>`;
  const PER = 6, $ = id => document.getElementById(id);
  const sorters = {
    views: (a, b) => (+b.viewers || 0) - (+a.viewers || 0),
    new: (a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0),
    name: (a, b) => dn(a).localeCompare(dn(b))
  };
  let page = 1, on = [], tier = 'Semua';
  const render = () => {
    const q = $('q').value.trim().toLowerCase();
    const tiers = ['Semua', ...TIERS.filter(t => on.some(m => m.tier === t))];
    if (!tiers.includes(tier)) tier = 'Semua';
    const sig = tiers.join('|') + '|' + tier;
    if ($('tier').dataset.sig !== sig) {
      $('tier').innerHTML = tiers.map(t => `<option value="${esc(t)}" ${t === tier ? 'selected' : ''}>${t === 'Semua' ? 'Semua tier' : esc(t) + ' (' + on.filter(m => m.tier === t).length + ')'}</option>`).join('');
      $('tier').dataset.sig = sig;
    }
    $('tierwrap').hidden = tiers.length < 3;
    const list = on.filter(m => (tier === 'Semua' || m.tier === tier) && `${dn(m)} ${m.name} ${m.liveTitle || ''}`.toLowerCase().includes(q))
      .sort(sorters[$('sort').value]);
    const pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    countTo($('n'), on.length);
    countTo($('mview'), on.reduce((t, m) => t + (+m.viewers || 0), 0));
    $('stack').innerHTML = on.slice(0, 5).map(m => `<span class="av s" title="${esc(dn(m))}">${avatar(m)}</span>`).join('') + (on.length > 5 ? `<span class="av s">+${on.length - 5}</span>` : '');
    $('count').textContent = list.length + ' live';
    $('liveGrid').innerHTML = list.length ? list.slice((page - 1) * PER, page * PER).map(liveCard).join('')
      : on.length ? '<div class="empty"><h3>Tidak ada hasil</h3><p>Coba kata kunci atau filter lain.</p></div>'
      : '<div class="empty"><h3>Belum ada siaran langsung</h3><p>Kartu akan muncul di sini saat ada anggota yang mulai siaran.</p><a class="btn" href="#/struktur">Lihat struktur</a></div>';
    $('pager').innerHTML = pages < 2 ? '' : Array.from({ length: pages }, (_, i) =>
      `<button class="pg ${i + 1 === page ? 'on' : ''}" data-p="${i + 1}" aria-label="Halaman ${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('');
  };
  $('q').oninput = () => { page = 1; render(); };
  $('sort').onchange = () => { page = 1; render(); };
  $('tier').onchange = () => { tier = $('tier').value; page = 1; render(); };
  $('pager').onclick = e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    page = +b.dataset.p; render();
    $('liveGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const countTo = (el, to) => {
    const from = +el.textContent || 0; if (from === to) return;
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 600); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  let tsig = '';
  const setTicker = () => {
    const sig = on.map(m => m.id + (m.liveTitle || '')).join('|');
    if (sig === tsig) return; tsig = sig;
    const item = m => `<span class="ti"><i class="dot"></i><b>${esc(dn(m))}</b>${m.liveTitle ? `<em>${esc(m.liveTitle)}</em>` : ''}</span>`;
    const grp = `<span class="tg">${on.map(item).join('')}</span>`;
    $('ticker').innerHTML = on.length ? `<div class="tk" style="--dur:${Math.max(24, on.length * 9)}s">${grp}${grp}</div>` : '<span class="tnone">Belum ada anggota yang live. Daftar diperbarui otomatis.</span>';
  };
  const draw = async () => { on = (await withStatus(members)).filter(m => m.live); render(); setTicker(); };
  let next = Date.now() + POLL_MS;
  const tick = () => {
    const s = Math.max(0, Math.ceil((next - Date.now()) / 1000));
    const sv = fresh(serverLive);
    $('scan').textContent = sv ? fmt(Math.max(0, Math.ceil((sv.updatedAt + SCAN_MS - Date.now()) / 1000))) : fmt(s);
    if (s === 0) { next = Date.now() + POLL_MS; draw(); }
    // Durasi live berjalan sendiri tanpa menunggu scan (dihitung dari jam mulai siaran)
    document.querySelectorAll('[data-since]').forEach(el => { const t = ago(el.dataset.since); if (el.textContent !== t) el.textContent = t; });
  };
  onLive = () => draw();
  tick(); await draw();
  timer = setInterval(tick, 1000);
}

async function struktur() {
  const members = await withStatus(await db.list('members'));
  const head = '<header class="pagehead"><h1>Struktur Organisasi</h1><p>Bagan jabatan BTS dari pimpinan sampai anggota.</p></header>';
  if (!members.length) { app.innerHTML = head + '<p class="muted">Struktur belum diisi.</p>'; return; }
  const byId = Object.fromEntries(members.map(m => [m.id, m]));
  const rank = m => { const i = TIERS.indexOf(m.tier); return i < 0 ? TIERS.length - 1 : i; };
  const parentOf = m => {
    if (m.parent && m.parent !== m.id && byId[m.parent]) return m.parent;
    for (let r = rank(m) - 1; r >= 0; r--) { const c = members.find(x => x.id !== m.id && rank(x) === r); if (c) return c.id; }
    return null;
  };
  const kids = {}, roots = [];
  members.forEach(m => { const p = parentOf(m); if (p) (kids[p] = kids[p] || []).push(m); else roots.push(m); });
  const seen = new Set();
  const node = m => {
    const url = safeUrl(m.live ? m.videoUrl || m.channelUrl : m.channelUrl), tag = url === '#' ? 'div' : 'a';
    return `<${tag} class="node t${rank(m)} ${m.live ? 'live' : ''}" ${tag === 'a' ? `href="${esc(url)}" target="_blank" rel="noopener"` : ''}>
      <b class="role">${esc(m.title || m.tier)}</b><span class="nm">${esc(m.name)}</span>${m.live ? '<em>Live</em>' : ''}</${tag}>`;
  };
  const branch = m => {
    seen.add(m.id);
    const k = (kids[m.id] || []).filter(c => !seen.has(c.id));
    return `<li>${node(m)}${k.length ? `<ul>${k.map(branch).join('')}</ul>` : ''}</li>`;
  };
  let html = roots.map(branch).join('');
  members.forEach(m => { if (!seen.has(m.id)) html += branch(m); });
  const chips = TIERS.map(t => [t, members.filter(m => m.tier === t).length]).filter(x => x[1])
    .map(([t, n]) => `<span class="chip">${esc(t)} <b>${n}</b></span>`).join('');
  app.innerHTML = head + `<div class="treebar"><div class="chips">${chips}</div>
    <div class="zoombar" role="group" aria-label="Zoom bagan"><button type="button" class="ghost" data-z="out" aria-label="Perkecil">−</button><span id="zv">100%</span><button type="button" class="ghost" data-z="in" aria-label="Perbesar">+</button><button type="button" class="ghost" data-z="fit">Pas layar</button></div></div><div class="treewrap"><div class="tree"><ul>${html}</ul></div></div>`;
  const wrap = app.querySelector('.treewrap'), tree = app.querySelector('.tree'), zv = app.querySelector('#zv');
  let z = 1, fitZ = 1, lastW = 0;
  const setZ = v => { z = Math.max(0.2, Math.min(2, v)); tree.style.zoom = z; zv.textContent = Math.round(z * 100) + '%'; };
  const fit = () => {
    if (!wrap.isConnected) return;
    tree.style.zoom = 1;
    lastW = wrap.clientWidth;
    fitZ = Math.min(1, (lastW - parseFloat(getComputedStyle(wrap).paddingLeft) * 2) / tree.offsetWidth);
    setZ(Math.max(0.5, fitZ));
  };
  app.querySelector('.zoombar').onclick = e => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    setZ(b.dataset.z === 'fit' ? fitZ : z * (b.dataset.z === 'in' ? 1.2 : 1 / 1.2));
  };
  // Cubit dua jari (HP) dan Ctrl + scroll (desktop)
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let d0 = 0, z0 = 1;
  wrap.addEventListener('touchstart', e => { if (e.touches.length === 2) { d0 = dist(e.touches); z0 = z; } }, { passive: true });
  wrap.addEventListener('touchmove', e => { if (e.touches.length === 2 && d0) { e.preventDefault(); setZ(z0 * dist(e.touches) / d0); } }, { passive: false });
  wrap.addEventListener('touchend', () => { d0 = 0; });
  wrap.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZ(z * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });
  fit();
  window.onresize = () => { if (wrap.isConnected && wrap.clientWidth !== lastW) fit(); };
}

async function blog() {
  const posts = await db.list('posts');
  app.innerHTML = '<header class="pagehead"><h1>Blog</h1><p>Kabar dan catatan terbaru dari komunitas.</p></header>' + (posts.map(p => `<a class="post" href="#/blog/${esc(p.id)}"><h3>${esc(p.title)}</h3><span class="muted">${esc(p.date)}</span></a>`).join('') || '<p class="muted">Belum ada tulisan.</p>');
}

async function post(id) {
  const p = (await db.list('posts')).find(x => x.id === id);
  app.innerHTML = p ? `<article class="article"><a href="#/blog">← Semua tulisan</a><h1>${esc(p.title)}</h1><p class="muted">${esc(p.date)}</p>${paragraphs(p.body)}</article>` : '<p>Tulisan tidak ditemukan.</p>';
}

async function route() {
  clearInterval(timer);
  onLive = null;
  window.onresize = null;
  const [p = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + p));
  app.innerHTML = '<p class="muted">Memuat…</p>';
  try {
    if (p === 'struktur') await struktur();
    else if (p === 'blog') await (id ? post(id) : blog());
    else await home();
  } catch (e) { app.innerHTML = `<p>Gagal memuat: ${esc(e.message)}</p>`; }
  window.scrollTo(0, 0);
}
applySite(false, route);
addEventListener('hashchange', route);
route();

const top = document.querySelector('.top'), burger = document.querySelector('.burger'), scrim = document.querySelector('.scrim');
const setMenu = o => {
  top.classList.toggle('open', o);
  document.body.classList.toggle('menu-open', o);
  burger.setAttribute('aria-expanded', o);
  burger.setAttribute('aria-label', o ? 'Tutup menu' : 'Buka menu');
};
burger.onclick = () => setMenu(!top.classList.contains('open'));
scrim.onclick = () => setMenu(false);
addEventListener('hashchange', () => setMenu(false));
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

initTheme();
// Intro: lepas lapisan pembuka setelah animasinya selesai
setTimeout(() => { document.querySelector('.splash')?.remove(); document.documentElement.classList.remove('intro'); }, 1700);

document.querySelector('.fyear').textContent = new Date().getFullYear();
