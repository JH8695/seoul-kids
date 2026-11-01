// 일정 파일(.ics) 만들기와 "일정 정보 복사" 글. 네트워크·화면과 무관한 순수 함수예요.
import { fmtDate, fmtTime } from './format.js';

const CRLF = '\r\n';
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// 한 줄은 75바이트까지 — 넘으면 줄바꿈 + 공백으로 이어 씀(한글이 중간에서 잘리지 않게 글자 단위로)
export function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 맨 앞 공백 1바이트가 있음
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join(CRLF);
}

const utc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymdCompact = (ymd) => ymd.replace(/-/g, '');
const nextDay = (ymd) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * @param events [{ uid, title, start?: ISO, end?: ISO, date?: 'YYYY-MM-DD', location, description, alarms?: number[] }]
 *   start/end 가 있으면 시각 일정, date 만 있으면 하루 종일 일정. alarms 는 시작 몇 분 전 알림인지(분)
 */
export function buildIcs(events, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//seoul-kids//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@seoul-kids`, `DTSTAMP:${utc(now.toISOString())}`);
    if (e.start) {
      lines.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end ?? new Date(new Date(e.start).getTime() + 3600000).toISOString())}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymdCompact(e.date)}`, `DTEND;VALUE=DATE:${ymdCompact(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    for (const m of e.alarms ?? []) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join(CRLF) + CRLF;
}

const addMin = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();

/** 접수 시작 일정(인기 프로그램 알림용): 접수 시각에 10분짜리, 10분 전·1분 전 알림. 이미 지났으면 null */
export function applyEvent(course, now = Date.now()) {
  if (!course?.applyStart || new Date(course.applyStart).getTime() < now) return null;
  return {
    uid: `${course.id}-apply`,
    title: `[접수 시작] ${course.title}`,
    start: course.applyStart,
    end: addMin(course.applyStart, 10),
    location: course.place || undefined,
    description: `서울시 예약 사이트에서 접수가 시작돼요.\n${course.url ?? ''}`.trim(),
    alarms: [10, 1],
  };
}

const hhmm = (iso) => fmtTime(iso);

/**
 * 이용 일정: ymd 하루에 대해, 시간대를 읽은 경우 시간대마다 하나씩, 시각만 알면 하나, 시각을 모르면 하루 종일.
 * course 는 화면에 쓰는 형태(classStart/classEnd 의 시각, timeKnown, timeSlots).
 */
export function useEvents(course, ymd) {
  if (!ymd) return [];
  const base = { title: `[이용] ${course.title}`, location: course.place || undefined, description: `${course.url ?? ''}`.trim(), alarms: [60] };
  const at = (hm) => `${ymd}T${hm}:00+09:00`;
  if (course.timeSlots?.length > 1) {
    return course.timeSlots.map((s, i) => ({ ...base, uid: `${course.id}-use-${ymd}-${i}`, start: at(s.start), end: at(s.end) }));
  }
  if (course.timeKnown && course.classStart && hhmm(course.classStart) !== '00:00') {
    const s = hhmm(course.classStart);
    const e = course.classEnd ? hhmm(course.classEnd) : s;
    return [{ ...base, uid: `${course.id}-use-${ymd}`, start: at(s), end: e > s ? at(e) : undefined }];
  }
  return [{ ...base, uid: `${course.id}-use-${ymd}`, date: ymd, alarms: [] }];
}

/** 폰 캘린더 앱에 손으로 붙여넣을 글 */
export function eventText(ev) {
  const when = ev.start
    ? `${fmtDate(ev.start)} ${hhmm(ev.start)}${ev.end ? `–${hhmm(ev.end)}` : ''}`
    : `${fmtDate(`${ev.date}T12:00:00+09:00`)} (하루 종일)`;
  return [ev.title, when, ev.location ? `장소: ${ev.location}` : null, ev.description?.split('\n').pop() || null].filter(Boolean).join('\n');
}
