import assert from 'node:assert/strict';
import { cleanOffDays, toggleOffDay } from '../src/lib/offDays.js';
import { parseImport, buildExport } from '../src/lib/backup.js';
import { mergeUnion } from '../src/lib/sync.js';

// 표시 ↔ 해제, 정렬·중복 제거
let l = toggleOffDay([], '2026-11-21');
l = toggleOffDay(l, '2026-11-07');
assert.deepEqual(l, ['2026-11-07', '2026-11-21']);
assert.deepEqual(toggleOffDay(l, '2026-11-07'), ['2026-11-21']); // 다시 누르면 해제
// 이상한 값은 걸러냄
assert.deepEqual(cleanOffDays(['2026-11-21', '2026-11-21', '2026-02-30', 'abc', 5, null, '2026-1-1']), ['2026-11-21']);
assert.deepEqual(cleanOffDays(null), []);
assert.deepEqual(toggleOffDay(['2026-11-21'], '2026-13-01'), ['2026-11-21']); // 없는 날짜는 무시
assert.equal(cleanOffDays(Array.from({ length: 500 }, (_, i) => `2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)).length <= 336, true);
// 백업: 내보내고 가져와도 그대로, 이상한 값은 정리
assert.deepEqual(parseImport(buildExport({ offDays: ['2026-11-21', '2026-11-07'] })).settings.offDays, ['2026-11-07', '2026-11-21']);
assert.deepEqual(parseImport(JSON.stringify({ app: 'seoul-kids', v: 1, settings: { offDays: ['x', '2026-11-21'] } })).settings.offDays, ['2026-11-21']);
// 처음 계정 연결: 두 기기의 못 가는 날을 합침
assert.deepEqual(mergeUnion({ offDays: ['2026-11-21'] }, { offDays: ['2026-11-07'] }).offDays.sort(), ['2026-11-07', '2026-11-21']);
console.log('offdays.test.mjs OK');
