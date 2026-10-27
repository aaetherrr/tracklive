// Dijalankan GitHub Actions tiap 5 menit.
// Alur: baca member (Firestore) -> ambil video terbaru tiap channel -> tanya YouTube mana yang sedang live
//       -> simpan hasilnya ke Firestore (live/status). Situs hanya membaca hasil itu.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = process.env.YT_API_KEY;
if (!KEY || !process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Secret YT_API_KEY atau FIREBASE_SERVICE_ACCOUNT belum diisi di GitHub.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
let units = 0;

async function yt(path, params) {
  const u = new URL('https://www.googleapis.com/youtube/v3/' + path);
  Object.entries({ ...params, key: KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  const j = await r.json();
  units += 1;
  if (!r.ok) throw new Error(`${path}: ${j.error?.message || r.status}`);
  return j;
}

// Mengenali channel dari link: /channel/UC..., /@handle, /user/nama
function parseChannel(url) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    if (p[0] === 'channel' && /^UC[\w-]{22}$/.test(p[1] || '')) return { id: p[1] };
    if (p[0] && p[0].startsWith('@')) return { handle: p[0] };
    if (p[0] === 'user' && p[1]) return { username: p[1] };
  } catch (e) { /* link tidak valid */ }
  return null;
}

async function resolveChannel(url) {
  const p = parseChannel(url);
  if (!p) return null;
  if (p.id) return p.id;
  const j = await yt('channels', { part: 'id', ...(p.handle ? { forHandle: p.handle } : { forUsername: p.username }) });
  return j.items?.[0]?.id || null;
}

// Video terbaru channel: RSS dulu (tanpa kuota), cadangan: playlist uploads (1 unit)
async function recentIds(channelId) {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (r.ok) {
      const ids = [...(await r.text()).matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map(m => m[1]).slice(0, 8);
      if (ids.length) return ids;
    }
  } catch (e) { /* lanjut ke cadangan */ }
  const j = await yt('playlistItems', { part: 'contentDetails', playlistId: 'UU' + channelId.slice(2), maxResults: 8 });
  return (j.items || []).map(i => i.contentDetails.videoId);
}

const members = (await db.collection('members').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.channelUrl);
const cache = (await db.doc('live/cache').get()).data() || {};
const prev = (await db.doc('live/status').get()).data() || {};
let cacheDirty = false;
const chan = {}, untracked = [];

for (const m of members) {
  let c = cache[m.id];
  if (!c || c.url !== m.channelUrl) {
    try {
      c = { url: m.channelUrl, id: await resolveChannel(m.channelUrl) };
      cache[m.id] = c; cacheDirty = true;
    } catch (e) { console.warn(`Gagal mengenali channel ${m.name}: ${e.message}`); untracked.push(m.id); continue; }
  }
  if (c.id) chan[m.id] = c.id;
  else { untracked.push(m.id); console.warn(`Channel ${m.name} tidak dikenali: ${m.channelUrl}. Pakai bentuk youtube.com/@nama atau youtube.com/channel/UC...`); }
}

const owner = {}, carry = new Set();
for (const [mid, cid] of Object.entries(chan)) {
  try { (await recentIds(cid)).forEach(v => { owner[v] = mid; }); }
  catch (e) { console.warn(`Gagal ambil video channel ${mid}: ${e.message}`); carry.add(mid); }
}

const ids = Object.keys(owner), items = {};
for (let i = 0; i < ids.length; i += 50) {
  const j = await yt('videos', { part: 'snippet,liveStreamingDetails', id: ids.slice(i, i + 50).join(',') });
  for (const v of j.items || []) {
    if (v.snippet.liveBroadcastContent !== 'live') continue;
    const mid = owner[v.id], t = v.snippet.thumbnails || {}, d = v.liveStreamingDetails || {};
    const cand = {
      videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
      liveTitle: v.snippet.title,
      thumb: (t.maxres || t.standard || t.high || {}).url || '',
      viewers: d.concurrentViewers || '',
      startedAt: d.actualStartTime || ''
    };
    if (!items[mid] || cand.startedAt > items[mid].startedAt) items[mid] = cand;
  }
}
// Jika pengambilan satu channel gagal, pertahankan status sebelumnya agar tidak berkedip
carry.forEach(mid => { if (prev.items?.[mid]) items[mid] = prev.items[mid]; });

await db.doc('live/status').set({ updatedAt: Date.now(), items, untracked });
if (cacheDirty) await db.doc('live/cache').set(cache);
console.log(`Selesai. Member dicek: ${Object.keys(chan).length}, sedang live: ${Object.keys(items).length}, tidak dikenali: ${untracked.length}, kuota terpakai: ${units} unit.`);
