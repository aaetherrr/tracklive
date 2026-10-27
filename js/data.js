import { firebaseConfig, DEMO } from './config.js';

const seed = {
  members: Array.from({ length: 8 }, (_, i) => ({
    id: 'm' + (i + 1), name: 'Anggota ' + (i + 1), tier: i === 0 ? 'Leader' : i === 1 ? 'Co-Leader' : i < 4 ? 'Kepala Divisi' : 'Member', parent: i >= 4 ? 'm' + (i < 6 ? 3 : 4) : '',
    title: 'Data contoh', viewers: String(40 + i * 17), startedAt: new Date(Date.now() - (i + 1) * 17 * 60000).toISOString(), liveTitle: 'Contoh judul siaran langsung ' + (i + 1), order: i + 1, channelUrl: '', videoUrl: '', manualLive: i < 7
  })),
  posts: [
    { id: 'p1', title: 'Selamat datang di BTS', date: '2026-10-25', body: 'Ini postingan contoh. Hapus atau edit dari panel admin.' }
  ]
};

let fb;
async function init() {
  if (DEMO || fb) return;
  const b = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [app, au, fs] = await Promise.all([
    import(b + 'firebase-app.js'), import(b + 'firebase-auth.js'), import(b + 'firebase-firestore.js')
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { au, fs, auth: au.getAuth(a), db: fs.getFirestore(a) };
}

const local = col => JSON.parse(localStorage.getItem('bts_' + col) || 'null') || seed[col];
const putLocal = (col, rows) => localStorage.setItem('bts_' + col, JSON.stringify(rows));

export const db = {
  async list(col) {
    await init();
    let rows;
    if (DEMO) rows = local(col);
    else {
      const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, col));
      rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }
    return col === 'members'
      ? rows.sort((a, b) => (a.order || 99) - (b.order || 99))
      : rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },
  async save(col, obj) {
    await init();
    const { id, ...data } = obj;
    if (DEMO) {
      const rows = local(col);
      if (id) rows.splice(rows.findIndex(r => r.id === id), 1, obj);
      else rows.push({ ...data, id: crypto.randomUUID() });
      return putLocal(col, rows);
    }
    if (id) await fb.fs.setDoc(fb.fs.doc(fb.db, col, id), data);
    else await fb.fs.addDoc(fb.fs.collection(fb.db, col), data);
  },
  async get(col, id) {
    await init();
    if (DEMO) return JSON.parse(localStorage.getItem(`bts_${col}_${id}`) || 'null');
    const s = await fb.fs.getDoc(fb.fs.doc(fb.db, col, id));
    return s.exists() ? s.data() : null;
  },
  async set(col, id, data) {
    await init();
    if (DEMO) return localStorage.setItem(`bts_${col}_${id}`, JSON.stringify(data));
    await fb.fs.setDoc(fb.fs.doc(fb.db, col, id), data);
  },
  // Mendengarkan perubahan satu dokumen (hanya di mode Firebase)
  async listen(col, id, cb) {
    await init();
    if (DEMO) return () => {};
    return fb.fs.onSnapshot(fb.fs.doc(fb.db, col, id), s => cb(s.exists() ? s.data() : null), e => console.warn(e));
  },
  async remove(col, id) {
    await init();
    if (DEMO) return putLocal(col, local(col).filter(r => r.id !== id));
    await fb.fs.deleteDoc(fb.fs.doc(fb.db, col, id));
  }
};

export const auth = {
  async current() {
    await init();
    if (DEMO) return sessionStorage.getItem('bts_admin') === '1';
    return new Promise(res => { const un = fb.au.onAuthStateChanged(fb.auth, u => { un(); res(!!u); }); });
  },
  async login(email, pass) {
    await init();
    if (DEMO) {
      if (pass !== 'bts123') throw new Error('Password demo salah (bts123).');
      return sessionStorage.setItem('bts_admin', '1');
    }
    await fb.au.signInWithEmailAndPassword(fb.auth, email, pass);
  },
  async logout() {
    await init();
    if (DEMO) return sessionStorage.removeItem('bts_admin');
    await fb.au.signOut(fb.auth);
  }
};
