// 장소 페이지(가나다 순)용 목록 만들기. 화면과 상관없는 순수 함수예요.
import { placeName } from './places.js';

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const BASE = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }; // 쌍자음은 같은 칸으로
export const INITIAL_ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

/** 이름의 첫 글자 → 초성(ㄱㄴㄷ…) / 영문 대문자 / '#' */
export function initialOf(name) {
  const ch = String(name ?? '').trim()[0];
  if (!ch) return '#';
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const c = CHO[Math.floor((code - 0xac00) / 588)];
    return BASE[c] ?? c;
  }
  if (code >= 0x3131 && code <= 0x314e) return BASE[ch] ?? (INITIAL_ORDER.includes(ch) ? ch : '#'); // 이미 자음인 경우
  if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  return '#';
}

const norm = (x) => String(x ?? '').replace(/\s+/g, '').toLowerCase();

/**
 * @param rows   [{ placeKey, course:{place, area}, groupKey, status, isNew }] — 지금 보여줄 회차들
 * @param places 설정의 관심·제외 장소 { 열쇠: { s, n } }
 * @param q      이름 검색어
 * @returns { fav: Item[], hide: Item[], normal: [{ initial, items }] }
 *   Item = { key, name, area, programs, open, upcoming, news, state }
 *   - 관심(★) 장소는 지금 올라온 프로그램이 없어도 항상 목록에 있음
 *   - 제외(✕) 장소도 마찬가지(되돌릴 수 있게)
 */
export function buildPlaceList({ rows, places = {}, q = '' }) {
  const map = new Map();
  for (const r of rows) {
    if (!r.placeKey) continue;
    let it = map.get(r.placeKey);
    if (!it) {
      it = { key: r.placeKey, name: placeName(r.course), area: r.course.area || '', groups: new Map(), news: new Set(), state: places[r.placeKey]?.s ?? null, memo: places[r.placeKey]?.memo ?? '' };
      map.set(r.placeKey, it);
    }
    const g = it.groups.get(r.groupKey) ?? { open: false, upcoming: false };
    if (r.status === 'open') g.open = true;
    if (r.status === 'upcoming') g.upcoming = true;
    it.groups.set(r.groupKey, g);
    if (r.isNew) it.news.add(r.groupKey);
  }
  // 지금은 올라온 게 없지만 내가 정해 둔 장소
  for (const [key, v] of Object.entries(places)) {
    if (!map.has(key)) map.set(key, { key, name: v.n || key.split('|')[1] || key, area: key.split('|')[0] || '', groups: new Map(), news: new Set(), state: v.s ?? null, memo: v.memo ?? '' });
  }
  const nq = norm(q);
  const items = [...map.values()]
    .filter((it) => !nq || norm(it.name).includes(nq))
    .map((it) => {
      const gs = [...it.groups.values()];
      return {
        key: it.key, name: it.name, area: it.area, state: it.state, memo: it.memo,
        programs: it.groups.size,
        open: gs.filter((g) => g.open).length,
        upcoming: gs.filter((g) => g.upcoming && !g.open).length,
        news: it.news.size,
      };
    });
  const byName = (a, b) => a.name.localeCompare(b.name, 'ko') || a.area.localeCompare(b.area, 'ko');
  const fav = items.filter((i) => i.state === 'fav').sort(byName);
  const hide = items.filter((i) => i.state === 'hide').sort(byName);
  const buckets = new Map();
  items.filter((i) => !i.state && i.programs > 0).sort(byName).forEach((i) => {
    const k = initialOf(i.name);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  const normal = INITIAL_ORDER.filter((k) => buckets.has(k)).map((k) => ({ initial: k, items: buckets.get(k) }));
  return { fav, hide, normal };
}
