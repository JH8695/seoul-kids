// 관심 장소(★)와 제외 장소(✕). 장소 이름을 눌러서 정해요.
//   places: { [열쇠]: { s: 'fav' | 'hide', n: '표시 이름' } }
// 열쇠는 "구|장소명(공백 제거)" — 서울시 데이터에서 같은 장소가 띄어쓰기만 다르게 올라와도 하나로 묶임.

const squash = (x) => String(x ?? '').replace(/\s+/g, '').toLowerCase();

// 서울시 데이터는 "시설 · 세부 위치"(예: "○○센터 · 3층 강당")로 올라오는 경우가 있어서 앞의 시설 이름만 씀
const facilityOf = (place) => String(place ?? '').split(/\s*[·>]\s*/)[0].replace(/\s+/g, ' ').trim();

/** 강좌 → 장소 열쇠 (장소가 비어 있으면 null) */
export function placeKeyOf(course) {
  const p = squash(facilityOf(course?.place));
  if (!p) return null;
  return `${squash(course.area)}|${p}`;
}

export const placeName = (course) => facilityOf(course?.place);

/** 저장된 값 검증 (동기화·가져오기 때 이상한 값이 들어와도 앱이 깨지지 않게) */
export function cleanPlaces(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k || k.length > 120 || !v || (v.s !== 'fav' && v.s !== 'hide')) continue;
    out[k] = { s: v.s, n: String(v.n ?? '').slice(0, 60) };
  }
  return out;
}

/** 장소 상태 바꾸기: state 가 null 이면 해제. 한 장소는 관심과 제외 중 하나만 */
export function withPlace(places, key, name, state) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  if (state === 'fav' || state === 'hide') next[key] = { s: state, n: name };
  else delete next[key];
  return next;
}

export const placeState = (places, key) => (key ? places?.[key]?.s ?? null : null);
export const listPlaces = (places, state) =>
  Object.entries(places ?? {}).filter(([, v]) => v.s === state).map(([k, v]) => ({ key: k, name: v.n || k.split('|')[1] }));
