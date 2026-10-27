// Mode gelap/terang dengan transisi mulus (lingkaran membesar dari tombol; fallback: fade warna)
const root = document.documentElement;
const getTheme = () => root.dataset.theme === 'light' ? 'light' : 'dark';

function applyTheme(t) {
  root.dataset.theme = t;
  try { localStorage.setItem('bts_theme', t); } catch (e) { /* storage diblokir */ }
}

export function initTheme() {
  const btn = document.querySelector('.theme');
  if (!btn) return;
  const sync = () => {
    const dark = getTheme() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
    btn.setAttribute('aria-pressed', String(!dark));
  };
  sync();
  btn.onclick = () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce) {
      const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(() => { applyTheme(next); sync(); });
      vt.ready.then(() => root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      )).catch(() => {});
    } else {
      root.classList.add('theming');
      applyTheme(next); sync();
      setTimeout(() => root.classList.remove('theming'), 500);
    }
  };
}
