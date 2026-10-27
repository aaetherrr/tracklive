// ===== ISI BAGIAN INI =====
// 1. Firebase: Console > Project settings > Your apps > Web app > salin config.
//    Dibiarkan kosong = MODE DEMO (data di localStorage browser, password admin: bts123).
export const firebaseConfig = {
  apiKey: "AIzaSyAzqrL0Oy9Ad5yv1T49VjRfhDnXQkgKYTw",
  authDomain: "tracklive-ed2a9.firebaseapp.com",
  projectId: "tracklive-ed2a9",
  appId: "1:432038303523:web:c213b9b5f44813b5475e96"
};

// 2. YouTube Data API v3 key (opsional). Tanpa key, status live diatur manual
//    lewat centang "Sedang live" di admin. Batasi key ke domain GitHub Pages kamu.
export const YT_API_KEY = "";

export const DEMO = !firebaseConfig.apiKey;
export const POLL_MS = 60000; // cek status live tiap 60 detik
