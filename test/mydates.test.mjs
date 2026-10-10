import assert from 'node:assert/strict';
import { parseMyDates, fmtMyDate } from '../src/lib/mydates.js';

const C = (s, e) => ({ classStart: `${s}T10:00:00+09:00`, classEnd: `${e}T12:00:00+09:00` });
const win = C('2026-09-28', '2026-10-31');
const ymds = (t, c = win) => parseMyDates(t, c).dates.map((d) => d.ymd);

assert.deepEqual(ymds('10/17'), ['2026-10-17']);
assert.deepEqual(ymds('10월 17일'), ['2026-10-17']);
assert.deepEqual(ymds('10.17'), ['2026-10-17']);
assert.deepEqual(ymds('10/17, 10/24'), ['2026-10-17', '2026-10-24']);
assert.deepEqual(ymds('10/17 10/24'), ['2026-10-17', '2026-10-24']);
assert.deepEqual(ymds('10/17~10/20'), ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
assert.deepEqual(ymds('10/17~20'), ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
assert.deepEqual(ymds('10/17(토) 10/24(토)'), ['2026-10-17', '2026-10-24']); // 요일은 무시
assert.deepEqual(ymds('10/24, 10/17'), ['2026-10-17', '2026-10-24']); // 정렬
assert.deepEqual(ymds('10/17, 10/17'), ['2026-10-17']); // 중복 제거

// 읽지 못하는 것
assert.equal(parseMyDates('17일', win).dates.length, 0);
assert.match(parseMyDates('17일', win).bad, /17/);
assert.equal(parseMyDates('다음 주 토요일', win).dates.length, 0);
assert.equal(parseMyDates('2/30', win).dates.length, 0); // 없는 날짜
assert.match(parseMyDates('2/30', win).bad, /2/);
assert.equal(parseMyDates('10/17, 어쩌구', win).bad, '어쩌구'); // 일부만 읽힘

// 이용 기간 밖
const out = parseMyDates('12/7', win).dates;
assert.equal(out[0].ymd, '2026-12-07');
assert.equal(out[0].outside, true);
assert.equal(parseMyDates('10/17', win).dates[0].outside, false);

// 해를 넘기는 기간
assert.deepEqual(ymds('1/10', C('2026-12-20', '2027-01-31')), ['2027-01-10']);
assert.deepEqual(ymds('12/25', C('2026-12-20', '2027-01-31')), ['2026-12-25']);

assert.equal(fmtMyDate('2026-10-17'), '10/17(토)');
console.log('mydates.test.mjs OK');
