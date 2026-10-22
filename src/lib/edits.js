// "내 수정": 자동으로 읽은 대상·시간·요일이 틀렸을 때 사용자가 직접 고친 값.
// 강좌(예약) 하나마다 notes[id] 안에 함께 저장돼요 (메모·내 날짜와 같은 저장소 → 구글 동기화에도 포함).
//
//   note = {
//     text: '메모',
//     dates: ['2026-10-17', ...],        // 내 날짜 (있으면 달력은 이 날짜에만 찍힘)
//     fit:   { [아이id]: 'yes' | 'no' },  // 대상: 아이별로 "해당" / "해당 안 됨" (없으면 자동)
//     time:  { start: '14:00', end: '15:30' | null },  // 시간
//     days:  [6],  weeks: [2, 3],         // 요일 (+ 몇째 주)
//   }
// 고친 값이 항상 자동 판정보다 우선해요.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYCH = '일월화수목금토';

/** 저장 전 정리. 비어 있으면 null */
export function cleanNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 300) : '';
  if (text) out.text = text;
  const dates = Array.isArray(raw.dates) ? [...new Set(raw.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [];
  if (dates.length) out.dates = dates;
  if (raw.fit && typeof raw.fit === 'object') {
    const fit = {};
    for (const [id, v] of Object.entries(raw.fit)) if (v === 'yes' || v === 'no') fit[id] = v;
    if (Object.keys(fit).length) out.fit = fit;
  }
  if (raw.time && HHMM.test(raw.time.start ?? '')) {
    out.time = { start: raw.time.start, end: HHMM.test(raw.time.end ?? '') && raw.time.end >= raw.time.start ? raw.time.end : null };
  }
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
  if (days.length) {
    out.days = days;
    const weeks = Array.isArray(raw.weeks) ? [...new Set(raw.weeks.filter((w) => Number.isInteger(w) && w >= 1 && w <= 5))].sort((a, b) => a - b) : [];
    if (weeks.length) out.weeks = weeks;
  }
  return Object.keys(out).length ? out : null;
}

/** 어떤 항목을 고쳤는지 (카드의 "✎ 내 수정: 대상·시간" 표시용) */
export function editLabels(note) {
  const out = [];
  if (note?.fit && Object.keys(note.fit).length) out.push('대상');
  if (note?.time) out.push('시간');
  if (note?.days?.length) out.push('요일');
  if (note?.dates?.length) out.push('날짜');
  return out;
}

/** 아이별 판정에 내가 고친 값을 덮어씀. match.edited = true 로 표시 */
export function applyFit(kidMatches, note) {
  if (!note?.fit) return kidMatches;
  return kidMatches.map((k) => {
    const v = note.fit[k.kid.id];
    if (!v) return k;
    const tags = [...(k.match.tags ?? []).filter((t) => t !== '내 수정'), '내 수정'];
    return { ...k, match: { result: v === 'yes' ? 'match' : 'nomatch', tags, edited: true } };
  });
}

/** 선택한 아이 중 한 명이라도 "해당"으로 고쳤는가 (그러면 단체·성인 대상·제한없음 같은 자동 숨김도 풀림) */
export const forcedMatch = (activeKidMatches) => activeKidMatches.some((k) => k.match.edited && k.match.result === 'match');

/** 시작·종료 시각을 내가 적은 값으로 (날짜는 그대로). disp 를 새 객체로 돌려줌 */
export function applyTime(disp, time) {
  if (!time?.start || !disp.classStart) return disp;
  const d0 = disp.classStart.slice(0, 10);
  const d1 = (disp.classEnd ?? disp.classStart).slice(0, 10);
  return {
    ...disp,
    timeKnown: true,
    classStart: `${d0}T${time.start}:00+09:00`,
    classEnd: `${d1}T${time.end ?? time.start}:00+09:00`,
  };
}

/** 요일 표시 글: [6] → "토요일", [6,0] → "토·일", weeks [2,3] → "2·3째주 토" */
export function daysLabel(days, weeks) {
  const names = days.map((d) => DAYCH[d]).join('·');
  if (weeks?.length) return `${weeks.join('·')}째주 ${names}`;
  return days.length === 1 ? `${names}요일` : names;
}
