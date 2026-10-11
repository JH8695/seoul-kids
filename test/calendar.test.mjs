import assert from 'node:assert/strict';
import { occurrenceDates } from '../src/lib/calendar.js';

const C = (s, e) => ({ classStart: `${s}T10:00:00+09:00`, classEnd: `${e}T12:00:00+09:00` });
const SAT = new Set([6]);

// 우장산: 6~11월 토요일 2,3주, 8월 제외 (오늘 10/11)
let r = occurrenceDates(C('2026-05-25', '2026-11-21'), SAT, '2026-10-11', { weekOfMonth: [2, 3], excludeMonths: [8], weekdays: [6] });
assert.deepEqual(r.dates, ['2026-10-17', '2026-11-14', '2026-11-21']);
assert.equal(r.loose, false);

// 8월 제외 확인 (오늘 7/1): 7월 2·3째 토(11, 18), 8월 건너뜀, 9월 2·3째 토(12, 19)
r = occurrenceDates(C('2026-05-25', '2026-11-21'), SAT, '2026-07-01', { weekOfMonth: [2, 3], excludeMonths: [8], weekdays: [6] });
assert.ok(r.dates.includes('2026-07-11') && r.dates.includes('2026-07-18'));
assert.ok(!r.dates.some((d) => d.startsWith('2026-08')));
assert.ok(r.dates.includes('2026-09-12') && r.dates.includes('2026-09-19'));

// 송파책박물관: 9/5~11/28 매주 토요일, 휴강 9/26 · 10/3 · 10/10
r = occurrenceDates(C('2026-09-05', '2026-11-28'), SAT, '2026-09-20', { excludeDates: ['2026-09-26', '2026-10-03', '2026-10-10'] });
assert.deepEqual(r.dates, ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);

// 날짜가 직접 적힌 경우에도 휴강일은 뺌
r = occurrenceDates(C('2026-10-01', '2026-10-31'), null, '2026-10-01', { dates: ['2026-10-03', '2026-10-10'], excludeDates: ['2026-10-10'] });
assert.deepEqual(r.dates, ['2026-10-03']);

// 몇째 주 정보만 있고 요일을 모르면 무시(점선으로 남김)
r = occurrenceDates(C('2026-10-01', '2026-10-10'), null, '2026-10-01', { weekOfMonth: [2] });
assert.equal(r.loose, true);
assert.equal(r.dates.length, 10);

console.log('calendar.test.mjs OK');
