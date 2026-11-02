// "갈 수 없는 시간" 판정. 예: 토요일 10:00~11:50 은 안 돼요.
//
// 입력
//   busy : [{ id, days: [0~6], start: 'HH:MM', end: 'HH:MM' }]
//   slots: [{ start, end, days: number[]|null }]  — 설명에서 읽은 시간대(없으면 null)
//   range: { start, end } | null                  — 서울시 데이터의 가장 이른 시작 ~ 가장 늦은 끝(시간대가 합쳐진 값)
//   daySet: Set<number>|null                      — 프로그램이 열리는 요일(모르면 null)
// 결과
//   'ok'      겹치지 않음 (또는 판단할 정보가 없음)
//   'partial' 일부만 겹치거나 겹칠 수도 있음 → 숨기지 않고 "확인"으로 표시
//   'blocked' 열리는 모든 요일·시간대가 갈 수 없는 시간에 들어감 → 숨김
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
const overlaps = (a, b) => toMin(a.start) < toMin(b.end) && toMin(a.end) > toMin(b.start);
const inside = (a, b) => toMin(a.start) >= toMin(b.start) && toMin(a.end) <= toMin(b.end);

/** 저장 전 검증: 요일 1개 이상, 시각 형식 맞고 시작 < 끝 */
export function cleanBusy(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const b of list) {
    if (!b || typeof b !== 'object') continue;
    const days = Array.isArray(b.days) ? [...new Set(b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((x, y) => x - y) : [];
    if (!days.length || !HHMM.test(b.start ?? '') || !HHMM.test(b.end ?? '') || toMin(b.end) <= toMin(b.start)) continue;
    out.push({ id: String(b.id ?? `${days.join('')}-${b.start}-${b.end}`).slice(0, 40), days, start: b.start, end: b.end });
  }
  return out.slice(0, 20);
}

const plus60 = (s) => {
  const m = Math.min(toMin(s) + 60, 24 * 60 - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function classifyBusy({ busy, slots: rawSlots, range: rawRange, daySet }) {
  if (!busy?.length) return 'ok';
  // 시간대의 끝을 모르면(시작=끝) 한 시간짜리로 봄
  const slots = rawSlots?.map((s) => (toMin(s.end) > toMin(s.start) ? s : { ...s, end: plus60(s.start) })) ?? null;
  // 끝 시각이 없거나 시작과 같으면(시각 하나만 아는 경우) 한 시간짜리로 봄
  const range = rawRange ? { start: rawRange.start, end: toMin(rawRange.end) > toMin(rawRange.start) ? rawRange.end : plus60(rawRange.start) } : null;
  const days = daySet ? [...daySet] : [0, 1, 2, 3, 4, 5, 6];
  let blockedDays = 0;
  let touched = 0; // 겹침이 조금이라도 있는 요일 수
  for (const d of days) {
    const windows = busy.filter((b) => b.days.includes(d));
    if (!windows.length) continue;
    // 그 요일에 해당하는 시간대 후보
    let cand;
    if (slots?.length) {
      cand = slots.filter((s) => !s.days || s.days.includes(d));
      if (!cand.length) continue; // 이 요일에는 해당 시간대가 없음
    } else if (range) {
      cand = [range];
    } else {
      continue; // 시간을 모르면 판단하지 않음
    }
    const free = cand.filter((s) => !windows.some((w) => overlaps(s, w)));
    const fully = cand.every((s) => windows.some((w) => inside(s, w)));
    if (free.length === cand.length) continue; // 겹침 없음
    touched += 1;
    // 합쳐진 범위(range)만 아는 경우에는 일부만 겹치면 "겹칠 수도 있음"
    const certain = slots?.length ? free.length === 0 : fully;
    if (certain) blockedDays += 1;
  }
  if (!touched) return 'ok';
  // 요일을 알 때만 "모든 요일이 막힘"을 확정. 요일을 모르면 다른 요일에 열릴 수 있으므로 확인으로 둠
  if (daySet && blockedDays === days.filter((d) => busy.some((b) => b.days.includes(d))).length && blockedDays === days.length) return 'blocked';
  return 'partial';
}
