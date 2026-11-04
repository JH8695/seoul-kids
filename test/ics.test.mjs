import assert from 'node:assert/strict';
import { canCopyApply, copyTextFor } from '../src/lib/ics.js';
import { dateTrust } from '../src/lib/dateTrust.js';
import { fmtClassSchedule } from '../src/lib/format.js';

const NOW = new Date('2026-11-01T01:00:00Z');
const course = { id: 'S1', title: '숲체험, 가족; 놀이', place: '대모산숲', url: 'https://yeyak.seoul.go.kr/x', applyStart: '2026-11-05T10:00:00+09:00', classStart: '2026-11-07T10:00:00+09:00', classEnd: '2026-11-07T11:30:00+09:00', timeKnown: true };

// 접수 시작 일정은 접수 시각이 아직 안 지났을 때만 복사할 수 있음
assert.equal(canCopyApply(course, NOW.getTime()), true);
assert.equal(canCopyApply(course, new Date('2026-11-06T00:00:00Z').getTime()), false);
assert.equal(canCopyApply({ ...course, applyStart: null }, NOW.getTime()), false);

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
// 일정 복사 글
assert.equal(copyTextFor('apply', course), '[접수 시작] 숲체험, 가족; 놀이\n11/5(목) 10:00 접수 시작\n장소: 대모산숲\nhttps://yeyak.seoul.go.kr/x');
assert.equal(copyTextFor('use', course, { focusYmd: '2026-11-07' }), '[이용] 숲체험, 가족; 놀이\n11/7(토) 10:00–11:30\n장소: 대모산숲\nhttps://yeyak.seoul.go.kr/x');
assert.equal(
  copyTextFor('use', { ...course, timeSlots: [{ start: '10:00', end: '11:30' }, { start: '13:00', end: '14:30' }] }, { dates: ['2026-11-07', '2026-11-08'] }).split('\n')[1],
  '11/7(토) · 11/8(일) 10:00–11:30, 13:00–14:30',
);
assert.equal(copyTextFor('use', { ...course, timeKnown: false }, { focusYmd: '2026-11-07' }).split('\n')[1], '11/7(토)'); // 시각을 모르면 날짜만
// 이용 줄 글: 시간대가 둘 이상이면 나눠서
const oneDay = { classStart: '2026-11-08T14:00:00+09:00', classEnd: '2026-11-08T17:00:00+09:00', timeKnown: true };
assert.equal(fmtClassSchedule(oneDay), '11/8(일) 14:00–17:00');
assert.equal(fmtClassSchedule({ ...oneDay, timeSlots: [{ start: '14:00', end: '15:30' }, { start: '15:30', end: '17:00' }] }), '11/8(일) 14:00–15:30 · 15:30–17:00');
console.log('ics.test.mjs OK');
