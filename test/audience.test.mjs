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
// 설명에 어린이·가족이 나와도 "제한없음"이면 기본 노출하지 않음
assert.equal(audienceOf(C('숲 놀이터', '제한없음', '어린이와 함께 걷는 숲'), M('match')).kind, 'open');
assert.equal(audienceOf(C('성동구 정원투어', '제한없음', '어린이·가족 누구나 참여'), M('match')).kind, 'open');
assert.equal(audienceOf(C('시니어 요가', '제한없음'), M('match')).reason, 'adult');
// 일반 사례
assert.equal(audienceOf(C('짚공예', '유아(만5세이상), 초등학생'), M('match')).kind, 'kid');
assert.equal(audienceOf(C('역사 강좌', '성인'), M('nomatch')).kind, 'no');
assert.equal(audienceOf(C('가족 체험', '가족'), M('check')).kind, 'check');

// 괄호가 붙은 "제한없음"
assert.equal(isUnrestricted('제한없음(서울시민 누구나)'), true);
assert.equal(isUnrestricted('제한없음(대상:사회적 배려자-일정조율가능)'), true);
assert.equal(isUnrestricted('서울시민 누구나'), true);
assert.equal(isUnrestricted('제한없음(초등학생)'), false);
assert.equal(isUnrestricted('제한없음(6세 이상)'), false);
assert.equal(audienceOf(C('[12월 온라인] 정비사업 아카데미(12/7)', '제한없음(서울시민 누구나)'), M('match')).kind, 'open');

// 사회적 배려대상자 등 특정 계층
assert.equal(excludedReason(C('아차산 치유의 숲길 - 사회적 배려 대상자', '제한없음(대상:사회적 배려자-일정조율가능)')), 'targeted');
assert.equal(excludedReason(C('저소득 가정 어린이 체험', '어린이')), 'targeted');
assert.equal(excludedReason(C('한부모 가족 캠프', '가족')), 'targeted');
assert.equal(excludedReason(C('다문화 가족 숲놀이', '가족')), 'targeted');
assert.equal(excludedReason(C('다문화 가족과 일반 가족 함께 숲놀이', '가족')), null); // 일반도 같이 → 제외 안 함
assert.equal(audienceOf(C('아차산 치유의 숲길 - 사회적 배려 대상자', '제한없음'), M('match')).reason, 'targeted');

// 여러 연령 대상 표시
assert.equal(audienceOf(C('구의문화유산 견학', '성인, 청년, 청소년, 초등학생'), M('match')).note, '여러 연령 대상');

// 어린이집 등 기관 대상은 단체 전용
assert.equal(excludedReason(C('2026유아생태학교(10월,가을나들이)', '유아(어린이집 (5~7세))')), 'group');
assert.equal(excludedReason(C('숲 체험', '어린이집 원아')), 'group');
assert.equal(excludedReason(C('숲 체험', '어린이집 원아 및 개인')), null); // 개인도 가능
assert.equal(excludedReason(C('숲 체험', '유아(어린이집 다니는 아이와 보호자 동반)')), null); // 보호자 동반 가족
assert.equal(audienceOf(C('2026유아생태학교(10월,가을나들이)', '유아(어린이집 (5~7세))'), M('match')).reason, 'group');

// 난임·임산부 등 부모 대상 → 성인 대상
assert.equal(excludedReason(C('우장산 녹색복지센터 (6월~11월) 헤아림 , 토닥정원애 들다 (난임부부)', '가족(난임), 성인(난임), 여성(난임부부), 주부(난임부부 )')), 'adult');
assert.equal(excludedReason(C('우장산 녹색복지센터 (9월~11월) 숲태교 , 기다림', '가족(임산부), 성인(임산부), 여성(임산부), 주부(임산부 )')), 'adult');
assert.equal(audienceOf(C('숲태교 기다림', '가족(임산부), 성인(임산부)'), M('match')).reason, 'adult');
// 장소 이름의 "태교숲"만으로는 제외하지 않음 (대상이 유아·초등 가족)
assert.equal(excludedReason(C('[성북구] 산림치유 10월 북한산 태교숲(1,3주 일요일 오후) 쓰담쓰담 행복숲(유아, 초등 가족)', '유아, 초등 가족')), null);
// 임산부와 어린이가 함께 적힌 대상은 제외하지 않음
assert.equal(excludedReason(C('가족 숲놀이', '임산부 동반 가족, 어린이')), null);

console.log('audience.test.mjs OK');
