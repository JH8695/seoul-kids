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

/** 저장된 값 검증 (동기화·가져오기 때 이상한 값이 들어와도 앱이 깨지지 않게). 항목: { s?: 'fav'|'hide', n: 이름, memo?: 메모 } */
export function cleanPlaces(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k || k.length > 120 || !v || typeof v !== 'object') continue;
    const st = v.s === 'fav' || v.s === 'hide' ? v.s : null;
    const memo = typeof v.memo === 'string' ? v.memo.trim().slice(0, 200) : '';
    if (!st && !memo) continue; // 관심·제외도 메모도 없으면 저장할 이유가 없음
    out[k] = { ...(st ? { s: st } : {}), n: String(v.n ?? '').slice(0, 60), ...(memo ? { memo } : {}) };
  }
  return out;
}

/** 센터 상태 바꾸기: state 가 null 이면 해제(메모는 남김). 한 센터는 관심과 제외 중 하나만 */
export function withPlace(places, key, name, state) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  const prev = next[key];
  if (state === 'fav' || state === 'hide') next[key] = { ...prev, s: state, n: name };
  else if (prev?.memo) next[key] = { n: prev.n ?? name, memo: prev.memo };
  else delete next[key];
  return next;
}

/** 센터 메모 바꾸기(예: "지하철 25분 · 자차 15분"). 비우면 지움 */
export function withPlaceMemo(places, key, name, memo) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  const m = String(memo ?? '').trim().slice(0, 200);
  const prev = next[key];
  if (m) next[key] = { ...(prev?.s ? { s: prev.s } : {}), n: prev?.n ?? name, memo: m };
  else if (prev?.s) next[key] = { s: prev.s, n: prev.n ?? name };
  else delete next[key];
  return next;
}

export const placeMemoOf = (places, key) => (key ? places?.[key]?.memo ?? '' : '');
export const placeState = (places, key) => (key ? places?.[key]?.s ?? null : null);
export const listPlaces = (places, state) =>
  Object.entries(places ?? {}).filter(([, v]) => v.s === state).map(([k, v]) => ({ key: k, name: v.n || k.split('|')[1] }));
