// 다른 기기로 옮기기: 설정·찜·숨김·메모를 글 하나로 내보내고 가져옵니다.
export const EXPORT_KEYS = ['kids', 'activeKids', 'areas', 'days', 'favs', 'hidden', 'hiddenRounds', 'notes'];

export function buildExport(settings) {
  const out = {};
  EXPORT_KEYS.forEach((k) => { if (settings[k] !== undefined) out[k] = settings[k]; });
  return JSON.stringify({ app: 'seoul-kids', v: 1, settings: out });
}

const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** @returns { settings } 또는 { error } */
export function parseImport(text) {
  let obj;
  try { obj = JSON.parse(String(text).trim()); } catch { return { error: '내용을 읽지 못했어요. 내보내기로 복사한 글을 통째로 붙여넣어 주세요.' }; }
  if (obj?.app !== 'seoul-kids' || typeof obj.settings !== 'object' || obj.settings === null) {
    return { error: '이 앱에서 내보낸 내용이 아니에요.' };
  }
  const s = obj.settings;
  const out = {};
  if (s.kids !== undefined) {
    const ok = Array.isArray(s.kids) && s.kids.length > 0 && s.kids.every((k) => k && typeof k.id === 'string' && typeof k.label === 'string' && Number.isInteger(k.birthYear));
    if (!ok) return { error: '아이 정보가 올바르지 않아요.' };
    out.kids = s.kids.map((k) => ({ id: k.id, label: k.label.slice(0, 8), birthYear: k.birthYear }));
  }
  for (const k of ['activeKids', 'areas', 'favs', 'hidden', 'hiddenRounds']) {
    if (s[k] === undefined) continue;
    if (!strArr(s[k])) return { error: `"${k}" 항목이 올바르지 않아요.` };
    out[k] = s[k];
  }
  if (s.days !== undefined) {
    if (!Array.isArray(s.days) || !s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return { error: '요일 항목이 올바르지 않아요.' };
    out.days = s.days;
  }
  if (s.notes !== undefined) {
    if (typeof s.notes !== 'object' || s.notes === null || Array.isArray(s.notes)) return { error: '메모 항목이 올바르지 않아요.' };
    const notes = {};
    for (const [id, n] of Object.entries(s.notes)) {
      if (!n || typeof n !== 'object') continue;
      const dates = Array.isArray(n.dates) ? n.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
      notes[id] = { text: typeof n.text === 'string' ? n.text.slice(0, 300) : '', dates };
    }
    out.notes = notes;
  }
  return { settings: out };
}

// ---- 합치기 링크: 설정을 주소 뒤(#import=...)에 담아 다른 기기에서 열면 "합치기" ----
const toB64 = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (b64) => decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))));

export function buildShareLink(settings, baseUrl) {
  return `${baseUrl}#import=${toB64(buildExport(settings))}`;
}

/** @returns { settings } 또는 { error } */
export function parseShareHash(hash) {
  const m = String(hash).match(/^#import=(.+)$/);
  if (!m) return { error: '합치기 링크가 아니에요.' };
  let text;
  try { text = fromB64(m[1]); } catch { return { error: '링크를 읽지 못했어요. 링크가 중간에 잘렸을 수 있어요.' }; }
  return parseImport(text);
}
