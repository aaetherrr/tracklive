export const TIERS = ['Leader', 'Co-Leader', 'Kepala Divisi', 'Member'];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
export const paragraphs = t => esc(t).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
export const safeImg = u => /^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(u || '') ? u : '';
