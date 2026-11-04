// 관심 장소(★)와 제외 장소(✕). 장소 이름을 눌러서 정해요.
//   places: { [열쇠]: { s?: 'fav' | 'hide', n: '표시 이름', memo?, tr?: 대중교통 분, cr?: 자차 분 } }
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

/**
 * 화면에 보여줄 짧은 이름: 이름 앞의 "서울특별시 " 와 "○○구 " 를 뺌 (구는 따로 표시하니까).
 *   "서울특별시 동대문구 답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)" → "답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)"
 * 저장된 이름이나 센터 열쇠는 그대로 두고, 보여주기·정렬에만 써요. "강남구립도서관"처럼 구 뒤에 공백이 없으면 그대로 둠.
 */
export function shortPlaceName(name) {
  const full = String(name ?? '').replace(/\s+/g, ' ').trim();
  let t = full.replace(/^서울(?:특별)?시\s+/, '');
  t = t.replace(/^[가-힣]{1,5}구\s+/, '');
  return t || full;
}

// 이동시간(분): 직접 입력. tr=대중교통, cr=자차. 1~600 사이 정수만 인정
const minOf = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 600 ? n : null;
};

// 센터 항목 하나를 다시 만듦 (관심·제외 / 메모 / 이동시간 중 하나라도 있어야 저장)
function build(prev, name, patch = {}) {
  const v = { ...(prev ?? {}), ...patch };
  const st = v.s === 'fav' || v.s === 'hide' ? v.s : null;
  const memo = typeof v.memo === 'string' ? v.memo.trim().slice(0, 200) : '';
  const tr = minOf(v.tr);
  const cr = minOf(v.cr);
  if (!st && !memo && !tr && !cr) return null;
  return { ...(st ? { s: st } : {}), n: String(v.n ?? name ?? '').slice(0, 60), ...(memo ? { memo } : {}), ...(tr ? { tr } : {}), ...(cr ? { cr } : {}) };
}

/** 저장된 값 검증 (동기화·가져오기 때 이상한 값이 들어와도 앱이 깨지지 않게). 항목: { s?: 'fav'|'hide', n: 이름, memo?: 메모, tr?: 대중교통 분, cr?: 자차 분 } */
export function cleanPlaces(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k || k.length > 120 || !v || typeof v !== 'object') continue;
    const e = build(null, '', v);
    if (e) out[k] = e; // 관심·제외도 메모도 이동시간도 없으면 저장할 이유가 없음
  }
  return out;
}

/** 센터 상태 바꾸기: state 가 null 이면 해제(메모·이동시간은 남김). 한 센터는 관심과 제외 중 하나만 */
export function withPlace(places, key, name, state) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  const prev = next[key];
  const e = state === 'fav' || state === 'hide' ? build(prev, name, { s: state, n: name }) : build(prev, name, { s: null });
  if (e) next[key] = e;
  else delete next[key];
  return next;
}

/** 센터 메모 바꾸기(예: "주차 가능"). 비우면 지움 */
export function withPlaceMemo(places, key, name, memo) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  const e = build(next[key], name, { memo: String(memo ?? '') });
  if (e) next[key] = e;
  else delete next[key];
  return next;
}

/** 센터까지 걸리는 시간(분) 바꾸기. times = { tr?, cr? } 중 넘긴 것만 바뀌고, 비우거나 이상한 값이면 지움 */
export function withPlaceTimes(places, key, name, times) {
  const next = { ...(places ?? {}) };
  if (!key) return next;
  const patch = {};
  if (times && 'tr' in times) patch.tr = times.tr;
  if (times && 'cr' in times) patch.cr = times.cr;
  const e = build(next[key], name, patch);
  if (e) next[key] = e;
  else delete next[key];
  return next;
}

/**
 * 이동시간 필터. travel = { transit: 30|60|null, car: 20|40|null }
 *   - 둘 다 null 이면 필터 없음(항상 통과)
 *   - 하나만 고르면 그 조건, 둘 다 고르면 "둘 중 하나라도 맞으면" 통과
 *   - 고른 조건에 해당하는 시간을 입력하지 않은 센터는 통과하지 않음
 */
export function passesTravel(travel, entry) {
  const t = travel?.transit ?? null;
  const c = travel?.car ?? null;
  if (!t && !c) return true;
  const tr = minOf(entry?.tr);
  const cr = minOf(entry?.cr);
  return !!((t && tr && tr <= t) || (c && cr && cr <= c));
}

export const cleanTravel = (v) => {
  const ok = (x, list) => (list.includes(x) ? x : null);
  return { transit: ok(v?.transit, [30, 60]), car: ok(v?.car, [20, 40]) };
};

export const placeTimesOf = (places, key) => ({ tr: minOf(places?.[key]?.tr), cr: minOf(places?.[key]?.cr) });
export const placeMemoOf = (places, key) => (key ? places?.[key]?.memo ?? '' : '');
export const placeState = (places, key) => (key ? places?.[key]?.s ?? null : null);
export const listPlaces = (places, state) =>
  Object.entries(places ?? {}).filter(([, v]) => v.s === state).map(([k, v]) => ({ key: k, name: v.n || k.split('|')[1] }));

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
/** 화면에 보여줄 글: "🚇 25분 · 🚗 1시간 5분" (입력한 것만, 없으면 빈 글) */
export function timesText(times) {
  const tr = minOf(times?.tr);
  const cr = minOf(times?.cr);
  return [tr ? `🚇 ${fmtMin(tr)}` : '', cr ? `🚗 ${fmtMin(cr)}` : ''].filter(Boolean).join(' · ');
}
