// ===== ISI BAGIAN INI =====
// 1. Firebase: Console > Project settings > Your apps > Web app > salin config.
//    Dibiarkan kosong = MODE DEMO (data di localStorage browser, password admin: bts123).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

// 2. YouTube Data API v3 key (opsional). Tanpa key, status live diatur manual
//    lewat centang "Sedang live" di admin. Batasi key ke domain GitHub Pages kamu.
export const YT_API_KEY = "";

export const DEMO = !firebaseConfig.apiKey;
export const POLL_MS = 60000; // cek status live tiap 60 detik
