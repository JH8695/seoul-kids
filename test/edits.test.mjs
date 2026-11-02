import assert from 'node:assert/strict';
import { cleanNote, editLabels, applyFit, forcedMatch, applyTime, applyTimes, noteSlots, daysLabel } from '../src/lib/edits.js';

// ---- cleanNote: 정리·검증 ----
assert.equal(cleanNote(null), null);
assert.equal(cleanNote({}), null);
assert.equal(cleanNote({ text: '   ', dates: [], fit: {}, days: [] }), null); // 비어 있으면 저장하지 않음
assert.deepEqual(cleanNote({ text: ' 메모 ' }), { text: '메모' });
assert.deepEqual(cleanNote({ fit: { k1: 'yes', k2: 'no', k3: '모름' } }), { fit: { k1: 'yes', k2: 'no' } });
assert.deepEqual(cleanNote({ time: { start: '14:00', end: '15:30' } }), { slots: [{ start: '14:00', end: '15:30' }] }); // 예전 time 한 쌍도 slots 로
assert.deepEqual(cleanNote({ time: { start: '14:00', end: '13:00' } }), { slots: [{ start: '14:00', end: null }] }); // 끝이 시작보다 앞이면 버림
assert.equal(cleanNote({ time: { start: '25:00' } }), null);
assert.equal(cleanNote({ time: { start: '9:00' } }), null); // HH:MM 형식만
// 하루 여러 회차: 시작 순 정리, 같은 시간대는 한 번만, 잘못된 것은 버림
assert.deepEqual(
  cleanNote({ slots: [{ start: '15:00', end: '16:30' }, { start: '10:00', end: '11:30' }, { start: '10:00', end: '11:30' }, { start: 'x' }] }),
  { slots: [{ start: '10:00', end: '11:30' }, { start: '15:00', end: '16:30' }] },
);
assert.equal(cleanNote({ slots: [{ start: '10:00', end: '11:30' }, { start: '11:00' }, { start: '12:00' }, { start: '13:00' }, { start: '14:00' }, { start: '15:00' }, { start: '16:00' }] }).slots.length, 6); // 최대 6개
assert.deepEqual(noteSlots({ time: { start: '14:00', end: null } }), [{ start: '14:00', end: null }]); // 예전 형식 읽기
assert.deepEqual(noteSlots({ slots: [{ start: '10:00', end: null }] }), [{ start: '10:00', end: null }]);
assert.deepEqual(noteSlots(null), []);
assert.deepEqual(cleanNote({ days: [6, 0, 6, 9], weeks: [3, 2, 7] }), { days: [0, 6], weeks: [2, 3] });
assert.deepEqual(cleanNote({ days: [], weeks: [2] }), null); // 요일 없이 몇째 주만 있으면 의미 없음
assert.deepEqual(cleanNote({ dates: ['2026-10-17', '2026-10-17', 'x'] }), { dates: ['2026-10-17'] });

// ---- 어떤 항목을 고쳤나 ----
assert.deepEqual(editLabels({ fit: { k1: 'yes' }, slots: [{ start: '14:00', end: null }], days: [6] }), ['대상', '시간', '요일']);
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

// ---- 여러 시간대 적용 ----
{
  const one = applyTimes(disp, [{ start: '14:00', end: '15:30' }]);
  assert.equal(one.timeSlots, null);
  assert.equal(one.classStart, '2026-10-17T14:00:00+09:00');
  const two = applyTimes(disp, [{ start: '14:00', end: '15:30' }, { start: '16:00', end: '17:30' }]);
  assert.deepEqual(two.timeSlots.map((s) => `${s.start}-${s.end}`), ['14:00-15:30', '16:00-17:30']);
  assert.equal(two.classStart, '2026-10-17T14:00:00+09:00'); // 가장 이른 시작
  assert.equal(two.classEnd, '2026-10-24T17:30:00+09:00'); // 가장 늦은 끝
  assert.equal(two.timeKnown, true);
  assert.equal(applyTimes(disp, []), disp);
  // 끝을 비운 시간대는 시작과 같게 둠(없는 시각을 지어내지 않음)
  assert.equal(applyTimes(disp, [{ start: '14:00', end: null }, { start: '16:00', end: null }]).timeSlots[1].end, '16:00');
}

// ---- 요일 글 ----
assert.equal(daysLabel([6]), '토요일');
assert.equal(daysLabel([6, 0]), '토·일');
assert.equal(daysLabel([6], [2, 3]), '2·3째주 토');

console.log('edits.test.mjs OK');
