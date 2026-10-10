import assert from 'node:assert/strict';
import { audienceOf, excludedReason, isUnrestricted } from '../src/lib/audience.js';

const M = (result) => [{ kid: { id: 'k' }, match: { result } }];
const C = (title, targetText, snippet = '') => ({ title, targetText, snippet });

// 스크린샷 사례: 제목에 단체 → 제외
assert.equal(excludedReason(C('2026년 양재천 벼베기행사-유아단체', '유아(6~7세(만5~4세))')), 'group');
assert.equal(excludedReason(C('[서울숲]생물다양성 탐사대 (단체)', '어린이(8세 이상 어린이)')), 'group');
assert.equal(audienceOf(C('[서울숲]생물다양성 탐사대 (단체)', '어린이(8세 이상 어린이)'), M('match')).reason, 'group');
// 대상에 단체
assert.equal(excludedReason(C('숲 체험', '유아(6~7세 유아단체)')), 'group');
// 개인도 가능하면 제외하지 않음
assert.equal(excludedReason(C('숲 체험', '개인 및 단체')), null);
// 장애인
assert.equal(excludedReason(C('함께하는 숲', '장애인')), 'disabled');
assert.equal(excludedReason(C('발달장애 아동 미술', '어린이')), 'disabled');
assert.equal(excludedReason(C('장애물 달리기 체험', '어린이')), null); // "장애물"은 해당 없음
assert.equal(excludedReason(C('통합 미술 교실', '장애·비장애 아동 통합')), null);

// 제한없음
assert.equal(isUnrestricted('제한없음'), true);
assert.equal(isUnrestricted(' 제한 없음 '), true);
assert.equal(isUnrestricted('누구나'), true);
assert.equal(isUnrestricted('어린이(어린이를 동반한 어른), 제한없음'), false);
assert.equal(audienceOf(C('반딧불이 해설', '제한없음', '환경지표곤충 해설 프로그램'), M('match')).kind, 'open');
assert.equal(audienceOf(C('숲 놀이터', '제한없음', '어린이와 함께 걷는 숲'), M('match')).kind, 'kid');
assert.equal(audienceOf(C('시니어 요가', '제한없음'), M('match')).reason, 'adult');
// 일반 사례
assert.equal(audienceOf(C('짚공예', '유아(만5세이상), 초등학생'), M('match')).kind, 'kid');
assert.equal(audienceOf(C('역사 강좌', '성인'), M('nomatch')).kind, 'no');
assert.equal(audienceOf(C('가족 체험', '가족'), M('check')).kind, 'check');

console.log('audience.test.mjs OK');
