import { DEMO } from './config.js';
import { db, auth } from './data.js';
import { TIERS, esc } from './util.js';
import { paintMark, saveSite, loadTiers, DEFAULT_LINKS } from './site.js';

const defs = {
  members: { label: 'Member', title: r => r.name, sub: r => [r.tier, r.title].filter(Boolean).join(' · '), ini: r => (r.name || '?')[0], fields: [
    ['name', 'Nama karakter', 'text'], ['tier', 'Tier', 'select', TIERS], ['parent', 'Atasan langsung (kosong = otomatis menurut tier)', 'parent'], ['title', 'Jabatan / julukan', 'text'],
    ['order', 'Urutan (kecil = atas)', 'number'], ['avatar', 'URL foto (opsional)', 'url'],
    ['channelUrl', 'Link channel YouTube (mis. https://youtube.com/@nama), dipakai deteksi live otomatis', 'url'], ['videoUrl', 'Link live / video YouTube (opsional jika deteksi dari channel aktif)', 'url'], ['liveTitle', 'Judul live (opsional; otomatis jika pakai API key)', 'text'],
    ['manualLive', 'Sedang live (dipakai jika tanpa API key)', 'checkbox']] },
  posts: { label: 'Blog', title: r => r.title, sub: r => r.date || '', ini: r => (r.title || '?')[0], fields: [['title', 'Judul', 'text'], ['body', 'Isi (pisahkan paragraf dengan baris kosong)', 'textarea']] }
};

const I = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TAB_ICONS = {
  members: I('<path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>'),
  posts: I('<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>'),
  settings: I('<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')
};
const OUT = I('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>');
const tabsHtml = t => `<div class="tabs" role="tablist">${[['members', 'Member'], ['posts', 'Blog'], ['settings', 'Pengaturan']]
  .map(([k, l]) => `<button data-tab="${k}" class="${t === k ? 'on' : ''}">${TAB_ICONS[k]}<span>${l}</span></button>`).join('')}<button class="ghost out" id="out">${OUT}<span>Keluar</span></button></div>`;
const HEAD = {
  members: ['Member', 'Tambah dan atur member, tier, atasan, serta link channel YouTube.'],
  posts: ['Blog', 'Tulis dan kelola kabar untuk komunitas.'],
  settings: ['Pengaturan', 'Identitas situs, tier, dan tautan navbar.']
};
const head = t => `<header class="adm-head"><h1>${HEAD[t][0]}</h1><p>${HEAD[t][1]}</p></header>`;

const field = ([k, l, t, o], v, rows) => {
  if (t === 'checkbox') return `<div class="fld wide"><label class="ck"><input type="checkbox" name="${k}" ${v[k] ? 'checked' : ''}><span>${l}</span></label></div>`;
  const wide = t === 'textarea' || ['channelUrl', 'videoUrl', 'liveTitle'].includes(k) ? ' wide' : '';
  const ctl = t === 'select'
    ? `<select name="${k}">${o.map(x => `<option ${v[k] === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`
    : t === 'parent' ? `<select name="${k}"><option value="">Otomatis (sesuai tier)</option>${rows.filter(r => r.id !== v.id).map(r => `<option value="${esc(r.id)}" ${v[k] === r.id ? 'selected' : ''}>${esc(r.name)} (${esc(r.tier)})</option>`).join('')}</select>`
    : t === 'textarea' ? `<textarea name="${k}">${esc(v[k])}</textarea>`
    : `<input type="${t}" name="${k}" value="${esc(v[k])}" ${k === 'name' || k === 'title' ? 'required' : ''}>`;
  return `<div class="fld${wide}"><label>${l}</label>${ctl}</div>`;
};

const shrink = file => new Promise((res, rej) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url); res(c.toDataURL('image/png'));
  };
  img.onerror = () => rej(new Error('Gambar tidak bisa dibaca'));
  img.src = url;
});

export async function renderAdmin(app) {
  if (!(await auth.current())) return loginView(app);
  await loadTiers();
  app.classList.add('adm');
  let tab = 'members', edit = null;
  const note = DEMO ? '<div class="note">Mode demo: data hanya tersimpan di browser ini. Isi js/config.js untuk pakai Firebase.</div>' : '';
  const wireTabs = () => {
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; edit = null; draw(); });
    app.querySelector('#out').onclick = async () => { await auth.logout(); renderAdmin(app); };
  };
  const drawSettings = async () => {
    const s = (await db.get('settings', 'site')) || {};
    let logo = s.logo || '';
    app.innerHTML = `${tabsHtml(tab)}${head('settings')}${note}
      <div class="panel"><h3>Pengaturan situs</h3><form id="sf">
        <label>Nama situs</label><input name="siteName" value="${esc(s.siteName || 'BTS Live')}" required>
        <label>Subjudul (kecil, di bawah nama)</label><input name="tagline" value="${esc(s.tagline || 'Tracker')}">
        <label>Logo</label>
        <div class="logoedit"><div class="mark" id="lp"></div>
          <div class="lctl"><input type="file" id="lf" accept="image/*">
            <p class="muted small">PNG, JPG, atau WebP. Otomatis dikecilkan (maks. 200 px). Tanpa logo, situs memakai monogram teks.</p>
            <label>atau tempel URL gambar</label><input name="logoUrl" type="url" placeholder="https://..." value="${esc(logo.startsWith('data:') ? '' : logo)}">
            <p><button type="button" class="ghost" id="lc">Hapus logo</button></p></div></div>
        <p><button>Simpan pengaturan</button> <span id="ok" class="muted"></span></p></form></div>
      <div class="panel"><h3>Tier dan hierarki</h3>
        <p class="muted small">Urutan paling atas = puncak bagan struktur. Atasan member otomatis diambil dari tier di atasnya. Mengubah nama tier ikut memperbarui member yang sudah memakainya.</p>
        <div id="tl"></div>
        <p><button type="button" class="ghost" id="ta">+ Tambah tier</button></p>
        <p><button type="button" id="ts">Simpan tier</button> <span id="tok" class="muted"></span></p></div>
      <div class="panel"><h3>Tautan di navbar</h3>
        <p class="muted small">Tambah, ubah, atau hapus tautan (Discord, YouTube, Instagram, dll). Ikon menyesuaikan alamat secara otomatis. Alamat harus diawali https://</p>
        <div id="ll"></div>
        <p><button type="button" class="ghost" id="la">+ Tambah tautan</button></p>
        <p><button type="button" id="ls">Simpan tautan</button> <span id="lok" class="muted"></span></p></div>`;
    wireTabs();
    const ents = TIERS.map(t => ({ name: t, orig: t }));
    const tl = app.querySelector('#tl'), tmsg = app.querySelector('#tok');
    const drawTiers = () => {
      tl.innerHTML = ents.map((e, i) => `<div class="row tr"><span class="muted">${i + 1}</span><input data-i="${i}" value="${esc(e.name)}" aria-label="Nama tier ${i + 1}">
        <div><button type="button" class="ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Naik">↑</button><button type="button" class="ghost" data-dn="${i}" ${i === ents.length - 1 ? 'disabled' : ''} aria-label="Turun">↓</button><button type="button" class="del" data-rm="${i}" aria-label="Hapus">×</button></div></div>`).join('');
    };
    tl.oninput = e => { const i = e.target.dataset.i; if (i !== undefined) ents[i].name = e.target.value; };
    tl.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.up) { const i = +d.up; [ents[i - 1], ents[i]] = [ents[i], ents[i - 1]]; }
      else if (d.dn) { const i = +d.dn; [ents[i + 1], ents[i]] = [ents[i], ents[i + 1]]; }
      else if (d.rm) {
        if (ents.length < 2) return;
        if (!confirm(`Hapus tier "${ents[+d.rm].name}"? Member di tier ini perlu dipindah manual.`)) return;
        ents.splice(+d.rm, 1);
      }
      drawTiers();
    };
    app.querySelector('#ta').onclick = () => {
      ents.push({ name: '', orig: null }); drawTiers(); tl.querySelector('.row:last-child input').focus();
    };
    app.querySelector('#ts').onclick = async () => {
      const names = ents.map(e => e.name.trim());
      if (names.some(n => !n) || new Set(names.map(n => n.toLowerCase())).size !== names.length) { tmsg.textContent = 'Nama tier tidak boleh kosong atau kembar.'; return; }
      const members = await db.list('members');
      const ren = ents.map((e, i) => ({ from: e.orig, to: names[i] })).filter(r => r.from && r.from !== r.to);
      for (const mm of members) { const r = ren.find(x => x.from === mm.tier); if (r) await db.save('members', { ...mm, tier: r.to }); }
      const cur = (await db.get('settings', 'site')) || {};
      await saveSite({ ...cur, tiers: names });
      ents.forEach((e, i) => { e.name = names[i]; e.orig = names[i]; });
      const orphan = members.filter(mm => !names.includes((ren.find(x => x.from === mm.tier) || {}).to || mm.tier)).length;
      tmsg.textContent = 'Tersimpan.' + (orphan ? ` ${orphan} member punya tier yang sudah dihapus, ubah tiernya di tab Member.` : '');
      drawTiers();
    };
    drawTiers();
    const lks = (s.links ?? DEFAULT_LINKS).map(l => ({ ...l }));
    const ll = app.querySelector('#ll'), lmsg = app.querySelector('#lok');
    const drawLinks = () => {
      ll.innerHTML = lks.length ? lks.map((l, i) => `<div class="lr"><input data-k="label" data-i="${i}" value="${esc(l.label)}" placeholder="Nama (mis. Discord)" aria-label="Nama tautan ${i + 1}"><input data-k="url" data-i="${i}" type="url" value="${esc(l.url)}" placeholder="https://discord.gg/..." aria-label="Alamat tautan ${i + 1}"><button type="button" class="del" data-rm="${i}" aria-label="Hapus tautan">×</button></div>`).join('')
        : '<p class="muted small">Belum ada tautan. Klik "+ Tambah tautan".</p>';
    };
    ll.oninput = e => { const { i, k } = e.target.dataset; if (i !== undefined) lks[i][k] = e.target.value; };
    ll.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { lks.splice(+b.dataset.rm, 1); drawLinks(); } };
    app.querySelector('#la').onclick = () => { lks.push({ label: '', url: '' }); drawLinks(); ll.querySelector('.lr:last-child input').focus(); };
    app.querySelector('#ls').onclick = async () => {
      const clean = lks.map(l => ({ label: (l.label || '').trim(), url: (l.url || '').trim() })).filter(l => l.url);
      if (clean.some(l => !/^https?:\/\//i.test(l.url))) { lmsg.textContent = 'Alamat harus diawali http:// atau https://'; return; }
      const cur = (await db.get('settings', 'site')) || {};
      await saveSite({ ...cur, links: clean });
      lks.splice(0, lks.length, ...clean); drawLinks();
      lmsg.textContent = 'Tersimpan.';
    };
    drawLinks();
    const f = app.querySelector('#sf'), prev = () => paintMark(app.querySelector('#lp'), logo, f.siteName.value);
    prev();
    f.siteName.oninput = prev;
    f.logoUrl.oninput = () => { logo = f.logoUrl.value.trim(); prev(); };
    app.querySelector('#lc').onclick = () => { logo = ''; f.logoUrl.value = ''; app.querySelector('#lf').value = ''; prev(); };
    app.querySelector('#lf').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try { logo = await shrink(file); f.logoUrl.value = ''; prev(); }
      catch (x) { app.querySelector('#ok').textContent = x.message; }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const cur = (await db.get('settings', 'site')) || {};
      await saveSite({ ...cur, siteName: f.siteName.value.trim(), tagline: f.tagline.value.trim(), logo });
      app.querySelector('#ok').textContent = 'Tersimpan.';
    };
  };
  const draw = async () => {
    if (tab === 'settings') return drawSettings();
    const d = defs[tab], rows = await db.list(tab);
    const v = edit || {};
    app.innerHTML = `${tabsHtml(tab)}${head(tab)}${note}
      <div class="panel"><div class="ph"><h3>${edit ? 'Edit' : 'Tambah'} ${d.label}</h3>${edit ? '<span class="chip">Mode edit</span>' : ''}</div>
        <form id="f" class="fgrid">
        ${d.fields.map(f => field(f, v, rows)).join('')}
        <div class="fact"><button>Simpan ${d.label}</button>${edit ? '<button type="button" class="ghost" id="cancel">Batal</button>' : ''}</div></form></div>
      <div class="panel"><div class="ph"><h3>Daftar ${d.label}</h3><span class="chip">${rows.length}</span></div>${rows.map(r => `<div class="row"><div class="ri"><span class="av sm">${esc(d.ini(r))}</span><div class="rt"><b>${esc(d.title(r))}</b><span class="muted">${esc(d.sub(r))}</span></div></div>
        <div class="ra"><button class="ghost" data-e="${esc(r.id)}">Edit</button><button class="del" data-d="${esc(r.id)}">Hapus</button></div></div>`).join('') || '<p class="muted">Belum ada data.</p>'}</div>`;

    wireTabs();
    app.querySelector('#cancel')?.addEventListener('click', () => { edit = null; draw(); });
    app.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { edit = rows.find(r => r.id === b.dataset.e); draw(); scrollTo(0, 0); });
    app.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
      if (confirm('Hapus data ini?')) { await db.remove(tab, b.dataset.d); edit = null; draw(); }
    });
    app.querySelector('#f').onsubmit = async e => {
      e.preventDefault();
      const o = edit ? { ...edit } : {};
      d.fields.forEach(([k, , t]) => {
        const el = e.target.elements[k];
        o[k] = t === 'checkbox' ? el.checked : t === 'number' ? Number(el.value) || 99 : el.value.trim();
      });
      if (tab === 'posts' && !o.date) o.date = new Date().toISOString().slice(0, 10);
      await db.save(tab, o); edit = null; draw();
    };
  };
  draw();
}

function loginView(app) {
  app.classList.remove('adm');
  app.innerHTML = `<div class="login"><span class="mark lg-mark"><span class="mtxt">BTS</span></span>
    <h1>Masuk admin</h1><p class="muted">Gunakan akun admin yang terdaftar di Firebase.</p>
    <form id="l">${DEMO ? '<div class="note">Mode demo: isi email bebas, password <b>bts123</b>.</div>' : ''}
      <label>Email</label><input type="email" name="e" required autocomplete="username">
      <label>Password</label><input type="password" name="p" required autocomplete="current-password">
      <button class="wfull">Masuk</button><p id="err" style="color:var(--red)"></p></form></div>`;
  app.querySelector('#l').onsubmit = async e => {
    e.preventDefault();
    try { await auth.login(e.target.e.value, e.target.p.value); renderAdmin(app); }
    catch (x) { app.querySelector('#err').textContent = 'Gagal masuk: ' + x.message; }
  };
}
