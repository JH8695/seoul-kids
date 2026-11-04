// "일정 복사" 글: 캘린더 앱의 새 일정에 붙여넣기 좋은 글을 만들어요. 네트워크·화면과 무관한 순수 함수예요.
// (예전에는 .ics 일정 파일도 만들었지만 쓰지 않아서 뺐어요. 파일 이름만 그대로 ics.js 예요.)
import { fmtDate, fmtTime } from './format.js';
import { fmtMyDate } from './mydates.js';

/** 접수 시작 일정을 복사할 수 있는지: 접수 시각이 아직 안 지났을 때만 */
export function canCopyApply(course, now = Date.now()) {
  return !!course?.applyStart && new Date(course.applyStart).getTime() >= now;
}

const timeLine = (course) => {
  if (course.timeSlots?.length > 1) return course.timeSlots.map((s) => (s.end && s.end !== s.start ? `${s.start}–${s.end}` : s.start)).join(', ');
  if (course.timeKnown && course.classStart && fmtTime(course.classStart) !== '00:00') {
    const a = fmtTime(course.classStart);
    const b = course.classEnd ? fmtTime(course.classEnd) : a;
    return b !== a ? `${a}–${b}` : a;
  }
  return '';
};

/**
 * 복사할 글. kind: 'apply'(접수 시작) | 'use'(이용 일정)
 *   use 는 dates(이용 날짜 목록, 없으면 focusYmd 하루)와 시간대를 한 줄로 묶음
 */
export function copyTextFor(kind, course, { dates = [], focusYmd = null } = {}) {
  const tail = [course.place ? `장소: ${course.place}` : null, course.url ?? null];
  if (kind === 'apply') {
    return [`[접수 시작] ${course.title}`, `${fmtDate(course.applyStart)} ${fmtTime(course.applyStart)} 접수 시작`, ...tail].filter(Boolean).join('\n');
  }
  const ds = (dates.length ? dates : focusYmd ? [focusYmd] : []).slice(0, 12);
  const when = [ds.map((d) => fmtMyDate(d)).join(' · '), timeLine(course)].filter(Boolean).join(' ');
  return [`[이용] ${course.title}`, when || null, ...tail].filter(Boolean).join('\n');
}
