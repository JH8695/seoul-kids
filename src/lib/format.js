import { TZ } from './grade';

const dateFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short',
});
const timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});
const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

// 요일은 원문이 아니라 날짜에서 직접 계산 (원문과 어긋나면 수집기에서 경고용으로 비교 가능)
export function fmtDate(iso) {
  const d = new Date(iso);
  const parts = dateFmt.formatToParts(d);
  const v = (t) => parts.find((p) => p.type === t)?.value;
  return `${v('month')}/${v('day')}(${v('weekday')})`;
}

export function fmtTime(iso) {
  return timeFmt.format(new Date(iso)).replace('24:', '00:');
}

export function sameDay(a, b) {
  return ymdFmt.format(new Date(a)) === ymdFmt.format(new Date(b));
}

// 날짜만 있는 값("2026-10-10")은 시각을 지어내지 않고 날짜만 표시
export function fmtDateTime(iso) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fmtDate(iso);
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

export function fmtClassSchedule(c) {
  if (!c.classStart) return '일정 확인 필요';
  // 시각을 모르는 경우: 수집기가 표시했거나, 도서관 사이트가 (00:00~00:00)으로 비워 둔 경우
  const noTime =
    c.timeKnown === false ||
    (fmtTime(c.classStart) === '00:00' && (!c.classEnd || fmtTime(c.classEnd) === '00:00'));
  if (!c.classEnd || sameDay(c.classStart, c.classEnd)) {
    if (noTime) return fmtDate(c.classStart);
    const end = c.classEnd ? `–${fmtTime(c.classEnd)}` : '';
    return `${fmtDate(c.classStart)} ${fmtTime(c.classStart)}${end}`;
  }
  const rec = c.recurrence ? `${c.recurrence} ` : '';
  const n = c.sessions ? ` · 총 ${c.sessions}회` : '';
  const tm = noTime ? '' : ` · ${rec}${fmtTime(c.classStart)}–${fmtTime(c.classEnd)}`;
  return `${fmtDate(c.classStart)}~${fmtDate(c.classEnd)}${n}${tm}`;
}

export function daysUntil(iso, now = new Date()) {
  const a = new Date(ymdFmt.format(new Date(iso)) + 'T00:00:00+09:00');
  const b = new Date(ymdFmt.format(now) + 'T00:00:00+09:00');
  return Math.round((a - b) / 86400000);
}

export function fmtFetchedAt(iso) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

// 수업 시작 시각 'HH:MM'. 모르면 ''. (시각 미지정 표기 00:00 은 모르는 것으로 취급)
export function fmtStartTime(c) {
  if (!c.classStart || c.timeKnown === false) return '';
  const t = fmtTime(c.classStart);
  return t === '00:00' && (!c.classEnd || fmtTime(c.classEnd) === '00:00') ? '' : t;
}
