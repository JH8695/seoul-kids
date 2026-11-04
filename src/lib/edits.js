// "내 수정": 자동으로 읽은 대상·시간·요일이 틀렸을 때 사용자가 직접 고친 값.
// 강좌(예약) 하나마다 notes[id] 안에 함께 저장돼요 (메모·내 날짜와 같은 저장소 → 구글 동기화에도 포함).
//
//   note = {
//     text: '메모',
//     dates: ['2026-10-17', ...],        // 내 날짜 (있으면 달력은 이 날짜에만 찍힘)
//     fit:   { [아이id]: 'yes' | 'no' },  // 대상: 아이별로 "해당" / "해당 안 됨" (없으면 자동)
//     slots: [{ start: '14:00', end: '15:30' | null }, ...],  // 시간대(하루 여러 회차면 여러 개). 예전의 time 한 쌍도 읽어 줌
//     days:  [6],  weeks: [2, 3],         // 요일 (+ 몇째 주)
//     skip:  ['2026-11-21', ...],         // 숨긴 날짜("이 날짜만 숨기기"): 자동 날짜에서 이 날만 빼고 나머지는 그대로 따라감
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
  const skip = Array.isArray(raw.skip) ? [...new Set(raw.skip.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-120) : [];
  if (skip.length) out.skip = skip;
  if (raw.fit && typeof raw.fit === 'object') {
    const fit = {};
    for (const [id, v] of Object.entries(raw.fit)) if (v === 'yes' || v === 'no') fit[id] = v;
    if (Object.keys(fit).length) out.fit = fit;
  }
  // 시간대: slots(여러 개) 또는 예전 time(한 쌍). 시작 순으로 정리, 같은 시간대는 한 번만, 최대 6개
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : raw.time ? [raw.time] : [];
  const seen = new Set();
  const slots = [];
  for (const s of rawSlots) {
    if (!s || !HHMM.test(s.start ?? '')) continue;
    const end = HHMM.test(s.end ?? '') && s.end > s.start ? s.end : null;
    const k = `${s.start}-${end ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    slots.push({ start: s.start, end });
  }
  if (slots.length) out.slots = slots.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
  if (days.length) {
    out.days = days;
    const weeks = Array.isArray(raw.weeks) ? [...new Set(raw.weeks.filter((w) => Number.isInteger(w) && w >= 1 && w <= 5))].sort((a, b) => a - b) : [];
    if (weeks.length) out.weeks = weeks;
  }
  return Object.keys(out).length ? out : null;
}

/** 내가 고친 시간대 목록 (예전 time 한 쌍으로 저장된 것도 같은 모양으로) */
export function noteSlots(note) {
  if (note?.slots?.length) return note.slots;
  if (note?.time?.start) return [{ start: note.time.start, end: note.time.end ?? null }];
  return [];
}

/** 어떤 항목을 고쳤는지 (카드의 "✎ 내 수정: 대상·시간" 표시용) */
export function editLabels(note) {
  const out = [];
  if (note?.fit && Object.keys(note.fit).length) out.push('대상');
  if (noteSlots(note).length) out.push('시간');
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
    timeSlots: null, // 내가 시간을 고쳤으면 설명에서 읽은 시간대는 쓰지 않음
    timeSlotSrc: null,
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

/**
 * 내가 고친 시간대를 화면용 강좌(disp)에 적용.
 * 하나면 시작·종료 시각만 바꾸고, 둘 이상이면 가장 이른 시작 ~ 가장 늦은 끝을 범위로 두고 시간대 목록(timeSlots)도 채움.
 */
export function applyTimes(disp, slots) {
  if (!slots?.length || !disp.classStart) return disp;
  if (slots.length === 1) return { ...applyTime(disp, slots[0]), timeSlots: null, timeSlotSrc: null };
  const list = slots.map((s) => ({ start: s.start, end: s.end ?? s.start, days: null }));
  const first = list[0].start;
  const last = list.reduce((m, s) => (s.end > m ? s.end : m), first);
  const base = applyTime(disp, { start: first, end: last });
  return { ...base, timeSlots: list, timeSlotSrc: null };
}
