import { YT_API_KEY } from './config.js';

export function videoId(url = '') {
  const m = url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Hasil: { [memberId]: { live, viewers } }. Kosong jika tanpa API key (fallback ke centang manual).
export async function checkLive(members) {
  if (!YT_API_KEY) return {};
  const map = {}; members.forEach(m => { const v = videoId(m.videoUrl); if (v) map[v] = m.id; });
  const ids = Object.keys(map);
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&key=' +
      YT_API_KEY + '&id=' + ids.slice(i, i + 50).join(',');
    try {
      const r = await (await fetch(url)).json();
      (r.items || []).forEach(v => {
        const t = v.snippet.thumbnails || {};
        out[map[v.id]] = {
          live: v.snippet.liveBroadcastContent === 'live',
          viewers: v.liveStreamingDetails?.concurrentViewers,
          liveTitle: v.snippet.title,
          ytName: v.snippet.channelTitle,
          startedAt: v.liveStreamingDetails?.actualStartTime,
          thumb: (t.maxres || t.standard || t.high || {}).url
        };
      });
    } catch (e) { console.warn('YouTube API gagal', e); }
  }
  return out;
}
