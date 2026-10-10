import { TZ } from './grade';

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 화면 표시 순서: 월~일

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const noon = (iso) => new Date(`${ymd.format(new Date(iso))}T12:00:00+09:00`);
const dowOf = (iso) => noon(iso).getUTCDay(); // 한국 날짜 기준 요일 (정오 → UTC 03시라 같은 날)
const daysBetween = (a, b) => Math.round((noon(b) - noon(a)) / 86400000);

/**
 * 강좌가 열리는 요일 집합(0=일 … 6=토). 알 수 없으면 null.
 * - 하루짜리: 그 날의 요일
 * - 기간이 있고 "매주 목" 같은 표기가 있으면 그 요일
 * - 기간의 시작·끝 요일이 같으면 매주 그 요일로 추정
 * - 7일 이내 연속 기간이면 그 사이 모든 요일
 * - 그 외(요일 규칙을 알 수 없음)는 null → 필터에서 제외하지 않음
 */
export function classWeekdays(c) {
  if (!c.classStart) return null;
  // 제목·상세 글에서 "매주 토" 처럼 읽어 낸 요일이 있으면 그것이 가장 정확
  if (Array.isArray(c.weekdays) && c.weekdays.length) return new Set(c.weekdays);
  const start = dowOf(c.classStart);
  if (!c.classEnd) return new Set([start]);
  const span = daysBetween(c.classStart, c.classEnd);
  if (span <= 0) return new Set([start]);
  const m = (c.recurrence || '').match(/[일월화수목금토]/);
  if (m) return new Set([DAY_LABELS.indexOf(m[0])]);
  if (dowOf(c.classEnd) === start) return new Set([start]);
  if (span <= 6) {
    const out = new Set();
    for (let i = 0; i <= span; i++) out.add((start + i) % 7);
    return out;
  }
  return null;
}

export function passesDays(selected, daySet) {
  if (!selected || selected.length === 0) return true;
  if (daySet == null) return true;
  return selected.some((d) => daySet.has(d));
}
