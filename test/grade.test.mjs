import assert from 'node:assert/strict';
import { matchTarget, gradeOn } from '../src/lib/grade.js';

const d = (s) => new Date(s);
// 2017년생: 2026학년도 초3, 2027학년도 초4 / 2020년생: 2026 취학 전, 2027학년도 초1
assert.equal(gradeOn(2017, d('2026-10-10T12:00:00+09:00')), 3);
assert.equal(gradeOn(2020, d('2026-10-10T12:00:00+09:00')), 0);
assert.equal(gradeOn(2020, d('2027-03-10T12:00:00+09:00')), 1);
assert.equal(gradeOn(2017, d('2027-03-10T12:00:00+09:00')), 4);

const K = (text) => matchTarget(text, 0, 7, 2020).result; // 유치원(만 5~6세)
const E = (text) => matchTarget(text, 3, 10, 2017).result; // 초3
const cases = [
  // [대상 문구, 유치원, 초3]
  ['유아(만5세이상), 초등학생', 'match', 'match'],
  ['가족(학부모 1인, 자녀 1인)', 'match', 'match'],
  ['가족(초등학교 1~6학년 자녀를 동반한 가족)', 'nomatch', 'match'],
  ['어린이(어린이를 동반한 어른), 제한없음', 'match', 'match'],
  ['제한없음', 'match', 'match'],
  ['성인', 'nomatch', 'nomatch'],
  ['성인(50세 이상 성인)', 'nomatch', 'nomatch'],
  ['초등학생', 'nomatch', 'match'],
  ['유아', 'match', 'nomatch'],
  ['영유아(0~3세)', 'nomatch', 'nomatch'],
  ['초등 저학년', 'nomatch', 'match'],
  ['초등 고학년(4~6학년)', 'nomatch', 'nomatch'],
  ['', 'check', 'check'],
  // 개월 · 영아
  ['유아(영아(36개월 미만) 동반 가족)', 'nomatch', 'nomatch'],
  ['12~24개월', 'nomatch', 'nomatch'],
  ['36개월 미만', 'nomatch', 'nomatch'],
  ['영아 동반 가족', 'nomatch', 'nomatch'],
  ['영아(0~2세)', 'nomatch', 'nomatch'],
  ['60개월 이상', 'match', 'match'],
  ['84개월 이상', 'nomatch', 'match'],
  ['유아와 영아 동반 가족', 'match', 'match'], // 유아가 함께 적힌 경우는 그대로 해당
];
for (const [t, k, e] of cases) {
  assert.equal(K(t), k, `유치원: "${t}" → ${K(t)} (기대 ${k})`);
  assert.equal(E(t), e, `초3: "${t}" → ${E(t)} (기대 ${e})`);
}
console.log('grade.test.mjs OK');
