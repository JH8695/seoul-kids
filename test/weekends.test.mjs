import assert from 'node:assert/strict';
import { weekendList } from '../src/lib/weekends.js';

const flat = (l) => l.map((w) => w.days.map((d) => d.ymd));
// 수요일(2026-11-04): 이번 주말 11/7·8, 이후 매주
let l = weekendList('2026-11-04', 5);
assert.deepEqual(flat(l), [['2026-11-07', '2026-11-08'], ['2026-11-14', '2026-11-15'], ['2026-11-21', '2026-11-22'], ['2026-11-28', '2026-11-29'], ['2026-12-05', '2026-12-06']]);
assert.deepEqual(l.map((w) => w.label), ['이번 주말', '다음 주말', '11월 21일 주말', '11월 28일 주말', '12월 5일 주말']);
assert.deepEqual(l[0].days.map((d) => d.dow), [6, 0]);
// 토요일(11/7): 오늘부터 토·일
assert.deepEqual(flat(weekendList('2026-11-07', 2)), [['2026-11-07', '2026-11-08'], ['2026-11-14', '2026-11-15']]);
// 일요일(11/8): 이번 주말은 일요일 하루만
l = weekendList('2026-11-08', 3);
assert.deepEqual(flat(l), [['2026-11-08'], ['2026-11-14', '2026-11-15'], ['2026-11-21', '2026-11-22']]);
assert.equal(l[0].label, '이번 주말');
assert.equal(l[1].label, '다음 주말');
// 월요일·금요일, 연말(해가 바뀌는 주말)
assert.deepEqual(flat(weekendList('2026-11-09', 1)), [['2026-11-14', '2026-11-15']]);
assert.deepEqual(flat(weekendList('2026-11-13', 1)), [['2026-11-14', '2026-11-15']]);
assert.deepEqual(flat(weekendList('2026-12-30', 2)), [['2027-01-02', '2027-01-03'], ['2027-01-09', '2027-01-10']]);
console.log('weekends.test.mjs OK');
