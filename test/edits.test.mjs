import assert from 'node:assert/strict';
import { cleanNote, editLabels, applyFit, forcedMatch, applyTime, daysLabel } from '../src/lib/edits.js';

// ---- cleanNote: 정리·검증 ----
assert.equal(cleanNote(null), null);
assert.equal(cleanNote({}), null);
assert.equal(cleanNote({ text: '   ', dates: [], fit: {}, days: [] }), null); // 비어 있으면 저장하지 않음
assert.deepEqual(cleanNote({ text: ' 메모 ' }), { text: '메모' });
assert.deepEqual(cleanNote({ fit: { k1: 'yes', k2: 'no', k3: '모름' } }), { fit: { k1: 'yes', k2: 'no' } });
assert.deepEqual(cleanNote({ time: { start: '14:00', end: '15:30' } }), { time: { start: '14:00', end: '15:30' } });
assert.deepEqual(cleanNote({ time: { start: '14:00', end: '13:00' } }), { time: { start: '14:00', end: null } }); // 끝이 시작보다 앞이면 버림
assert.equal(cleanNote({ time: { start: '25:00' } }), null);
assert.equal(cleanNote({ time: { start: '9:00' } }), null); // HH:MM 형식만
assert.deepEqual(cleanNote({ days: [6, 0, 6, 9], weeks: [3, 2, 7] }), { days: [0, 6], weeks: [2, 3] });
assert.deepEqual(cleanNote({ days: [], weeks: [2] }), null); // 요일 없이 몇째 주만 있으면 의미 없음
assert.deepEqual(cleanNote({ dates: ['2026-10-17', '2026-10-17', 'x'] }), { dates: ['2026-10-17'] });

// ---- 어떤 항목을 고쳤나 ----
assert.deepEqual(editLabels({ fit: { k1: 'yes' }, time: { start: '14:00', end: null }, days: [6] }), ['대상', '시간', '요일']);
assert.deepEqual(editLabels({ text: '메모만' }), []);

// ---- 대상: 아이별로 덮어씀 ----
const KM = [
  { kid: { id: 'k1' }, grade: 0, match: { result: 'nomatch', tags: [] } },
  { kid: { id: 'k2' }, grade: 3, match: { result: 'match', tags: ['보호자 동반'] } },
];
let r = applyFit(KM, { fit: { k1: 'yes' } });
assert.equal(r[0].match.result, 'match');
assert.equal(r[0].match.edited, true);
assert.ok(r[0].match.tags.includes('내 수정'));
assert.equal(r[1].match.result, 'match'); // 안 고친 아이는 자동 그대로
assert.equal(r[1].match.edited, undefined);
r = applyFit(KM, { fit: { k2: 'no' } });
assert.equal(r[1].match.result, 'nomatch');
assert.equal(r[0].match.result, 'nomatch');
assert.equal(applyFit(KM, null), KM); // 수정이 없으면 그대로
// 자동 판정 객체를 바꾸지 않음
assert.equal(KM[0].match.result, 'nomatch');
assert.equal(forcedMatch(applyFit(KM, { fit: { k1: 'yes' } })), true);
assert.equal(forcedMatch(applyFit(KM, { fit: { k2: 'no' } })), false);
assert.equal(forcedMatch(KM), false); // 자동 해당은 "내가 고친 해당"이 아님

// ---- 시간: 날짜는 그대로, 시각만 ----
const disp = { classStart: '2026-10-17T10:00:00+09:00', classEnd: '2026-10-24T12:00:00+09:00', timeKnown: false };
let d = applyTime(disp, { start: '14:00', end: '15:30' });
assert.equal(d.classStart, '2026-10-17T14:00:00+09:00');
assert.equal(d.classEnd, '2026-10-24T15:30:00+09:00');
assert.equal(d.timeKnown, true);
d = applyTime(disp, { start: '14:00', end: null });
assert.equal(d.classEnd, '2026-10-24T14:00:00+09:00'); // 끝을 안 적으면 시작과 같게
assert.equal(applyTime(disp, null), disp);
assert.equal(disp.classStart, '2026-10-17T10:00:00+09:00'); // 원본은 그대로

// ---- 요일 글 ----
assert.equal(daysLabel([6]), '토요일');
assert.equal(daysLabel([6, 0]), '토·일');
assert.equal(daysLabel([6], [2, 3]), '2·3째주 토');

console.log('edits.test.mjs OK');
