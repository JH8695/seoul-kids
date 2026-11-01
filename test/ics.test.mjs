import assert from 'node:assert/strict';
import { buildIcs, fold, applyEvent, useEvents, eventText } from '../src/lib/ics.js';
import { dateTrust } from '../src/lib/dateTrust.js';

const NOW = new Date('2026-11-01T01:00:00Z');
const course = { id: 'S1', title: '숲체험, 가족; 놀이', place: '대모산숲', url: 'https://yeyak.seoul.go.kr/x', applyStart: '2026-11-05T10:00:00+09:00', classStart: '2026-11-07T10:00:00+09:00', classEnd: '2026-11-07T11:30:00+09:00', timeKnown: true };

// 접수 시작: 한국 10:00 → UTC 01:00, 알림 2개
const a = applyEvent(course, NOW.getTime());
const ics = buildIcs([a], NOW);
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
assert.ok(ics.includes('DTSTART:20261105T010000Z'));
assert.ok(ics.includes('DTEND:20261105T011000Z'));
assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
assert.ok(ics.includes('TRIGGER:-PT10M') && ics.includes('TRIGGER:-PT1M'));
// 쉼표·세미콜론·줄바꿈은 이스케이프, 줄바꿈은 항상 CRLF
const unfolded = ics.replace(/\r\n /g, '');
assert.ok(unfolded.includes('SUMMARY:[접수 시작] 숲체험\\, 가족\\; 놀이'));
assert.ok(!/[^\r]\n/.test(ics));
// 접수 시각이 지났으면 만들지 않음
assert.equal(applyEvent(course, new Date('2026-11-06T00:00:00Z').getTime()), null);
assert.equal(applyEvent({ ...course, applyStart: null }, NOW.getTime()), null);

// 이용 일정: 시각이 있으면 시각 일정, 시간대가 둘이면 둘, 시각을 모르면 하루 종일
const u1 = useEvents(course, '2026-11-07');
assert.equal(u1.length, 1);
assert.equal(u1[0].start, '2026-11-07T10:00:00+09:00');
assert.equal(u1[0].end, '2026-11-07T11:30:00+09:00');
const u2 = useEvents({ ...course, timeSlots: [{ start: '10:00', end: '11:30', days: null }, { start: '13:00', end: '14:30', days: null }] }, '2026-11-07');
assert.deepEqual(u2.map((e) => e.start), ['2026-11-07T10:00:00+09:00', '2026-11-07T13:00:00+09:00']);
const u3 = useEvents({ ...course, timeKnown: false }, '2026-11-07');
assert.equal(u3[0].date, '2026-11-07');
const allDay = buildIcs(u3, NOW);
assert.ok(allDay.includes('DTSTART;VALUE=DATE:20261107') && allDay.includes('DTEND;VALUE=DATE:20261108'));
assert.deepEqual(useEvents(course, null), []);

// 긴 한글 줄은 75바이트 안에서 글자 중간이 아닌 곳에서 접힘
const long = fold(`SUMMARY:${'가나다라마바사'.repeat(12)}`);
const enc = new TextEncoder();
for (const line of long.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
assert.equal(long.replace(/\r\n /g, ''), `SUMMARY:${'가나다라마바사'.repeat(12)}`);

// 복사용 글
assert.equal(eventText(a), '[접수 시작] 숲체험, 가족; 놀이\n11/5(목) 10:00–10:10\n장소: 대모산숲\nhttps://yeyak.seoul.go.kr/x');

// 날짜 신뢰도
const T = (o) => dateTrust({ dateSource: null, tinfo: {}, course: { classStart: '2026-11-01T00:00:00+09:00', classEnd: '2026-12-30T00:00:00+09:00' }, standing: false, ...o })?.level;
assert.equal(T({ dateSource: 'title' }), 'sure');
assert.equal(T({ dateSource: 'detail' }), 'sure');
assert.equal(T({ dateSource: 'mine' }), 'sure');
assert.equal(T({ tinfo: { weekdays: [6] } }), 'mid');
assert.equal(T({ course: { weekdays: [6], classStart: '2026-11-01', classEnd: '2026-12-30' } }), 'mid');
assert.equal(T({ course: { classStart: '2026-11-07T10:00:00+09:00', classEnd: '2026-11-07T11:00:00+09:00' } }), 'mid');
assert.equal(T({}), 'guess');
assert.equal(T({ standing: true }), undefined);
console.log('ics.test.mjs OK');
