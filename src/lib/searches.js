// 최근 검색어(최대 10개)와 고정한 검색어. 엔터를 치거나 검색창을 벗어날 때 저장해요.
//   searches: { recent: ['방배', ...], pinned: ['유아숲', ...] }
export const MAX_RECENT = 10;
export const MAX_PINNED = 10;

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleanList = (v, max) => {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const x of v) {
    const t = norm(x).slice(0, 30);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

export function cleanSearches(obj) {
  return { recent: cleanList(obj?.recent, MAX_RECENT), pinned: cleanList(obj?.pinned, MAX_PINNED) };
}

/** 새 검색어 기록: 한 글자짜리는 기록하지 않음, 같은 말은 맨 앞으로, 고정한 말은 최근 목록에 중복으로 넣지 않음 */
export function addRecent(searches, term) {
  const s = cleanSearches(searches);
  const t = norm(term).slice(0, 30);
  if (t.length < 2) return s;
  if (s.pinned.some((p) => p.toLowerCase() === t.toLowerCase())) return s;
  return { ...s, recent: cleanList([t, ...s.recent], MAX_RECENT) };
}

export function removeTerm(searches, term) {
  const s = cleanSearches(searches);
  const k = norm(term).toLowerCase();
  return { recent: s.recent.filter((x) => x.toLowerCase() !== k), pinned: s.pinned.filter((x) => x.toLowerCase() !== k) };
}

/** 고정 ↔ 고정 해제. 고정하면 최근 목록에서 옮겨 가고, 해제하면 최근 목록 맨 앞으로 돌아옴 */
export function togglePin(searches, term) {
  const s = cleanSearches(searches);
  const t = norm(term);
  const k = t.toLowerCase();
  if (s.pinned.some((x) => x.toLowerCase() === k)) {
    return { recent: cleanList([t, ...s.recent], MAX_RECENT), pinned: s.pinned.filter((x) => x.toLowerCase() !== k) };
  }
  return { recent: s.recent.filter((x) => x.toLowerCase() !== k), pinned: cleanList([...s.pinned, t], MAX_PINNED) };
}
