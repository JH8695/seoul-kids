import assert from 'node:assert/strict';
import { refineMatch } from '../src/lib/targetRefine.js';
import { matchTarget, gradeOn, koreanAge } from '../src/lib/grade.js';
import { extractTitleTarget } from '../src/lib/title.js';
import { parseDetailTarget, cleanText } from '../scripts/seoul.mjs';

const d = new Date('2026-11-10T06:30:00Z');
const KID = { small: 2020, big: 2017 }; // 유치원(만 6세) / 초3
const run = (targetText, texts) =>
  Object.fromEntries(Object.entries(KID).map(([n, by]) => {
    const g = gradeOn(by, d), a = koreanAge(by, d);
    return [n, refineMatch(matchTarget(targetText, g, a, by), texts, g, a, by).match.result];
  }));

// ── 제목에서 대상 읽기 ──
assert.equal(extractTitleTarget('[월드컵공원] 노을별누리 가족별여행(11월 (금, 토, 일)/4학년 이상 가족)'), '4학년 이상'); // "/" 뒤
assert.equal(extractTitleTarget('(도봉구)뚝딱뚝딱 놀이터 주말 가족 프로그램(초등생)'), '초등생');
assert.equal(extractTitleTarget('가을 체험 10/4 토요일 운영'), null); // 날짜는 대상이 아님
assert.equal(extractTitleTarget('10/4학년 모임'), null); // 숫자 바로 뒤 슬래시는 날짜로 봄
assert.equal(extractTitleTarget('초등 1~3학년 과학교실'), '초등 1~3학년');

// 제목의 "/초등/" (서울식물원 어린이정원학교 사례: 대상 칸은 "어린이"라서 둘 다 "해당"이었음)
assert.equal(extractTitleTarget('[서울식물원/토요일/초등/11월]어린이정원학교: 출동!기후히어로'), '초등');
assert.equal(extractTitleTarget('[서울식물원/수요일/초등/11월]어린이정원학교: 꼬마식물학자'), '초등');
assert.equal(extractTitleTarget('초등부 합창단'), '초등부');
assert.equal(extractTitleTarget('[서울식물원/토요일/가족/11월]어린이정원학교: 함께정원'), null); // 가족은 대상을 좁히지 않음
assert.equal(extractTitleTarget('초등학교 방문 체험'), null); // 학교 이름은 대상이 아님
assert.equal(extractTitleTarget('서울초등학교 체험'), null);
assert.equal(extractTitleTarget('[유아/11월] 숲놀이'), '유아');
assert.equal(extractTitleTarget('유아숲 체험'), null); // 시설 이름에 붙은 유아는 대상이 아님
assert.equal(extractTitleTarget('초등 저학년 과학교실'), '초등 저학년');

// ── 상세내용의 대상 줄 읽기 ──
const det = cleanText('<p><strong>○ 운영일시 : 11월 1,6,7,8일</strong></p><p><strong>○ 모집대상 : 초등학교 4학년 이상 동반가족</strong><br><strong>- 보호자 동반 필수, 어린이만 들여보내시면 안 됩니다.</strong><br><strong>- 참여인원 수 지켜주시기 바랍니다.</strong></p><p><strong>○ 모집인원 : 5팀</strong></p>');
assert.equal(parseDetailTarget(det), '초등학교 4학년 이상 동반가족');
assert.equal(parseDetailTarget('■ 대 상 : 초등학생 (전 학년) 과 학부모 ■ 일시 : 토요일'), '초등학생 (전 학년) 과 학부모');
assert.equal(parseDetailTarget('참여대상 : 어린이(만7세이상)동반가족 참여인원 : 회차별 15명'), '어린이(만7세이상)동반가족');
assert.equal(parseDetailTarget('대상이 없는 글'), null);
assert.equal(parseDetailTarget('ㅇ 참여대상 : 어린이(만7세이상)동반가족 ㅇ 참여인원 : 회차별 15명 ㅇ 장소 : 남산'), '어린이(만7세이상)동반가족'); // ㅇ 글머리 기호

// ── 실제 사례 1: 노을별누리 "4학년 이상 가족" — 대상 칸은 "가족(어린이는 부모 동반 필수)" 라서 둘 다 "해당"이었음 ──
const NOEUL = '가족(어린이는 부모 동반 필수)';
assert.deepEqual(run(NOEUL, {}), { small: 'match', big: 'match' }); // 보정 없으면 예전 결과
assert.deepEqual(run(NOEUL, { titleTarget: '4학년 이상' }), { small: 'nomatch', big: 'nomatch' }); // 초3 도 4학년 미만
assert.deepEqual(run(NOEUL, { detailTarget: '초등학교 4학년 이상 동반가족' }), { small: 'nomatch', big: 'nomatch' }); // 상세내용만으로도
// 학년이 맞으면 그대로 해당
{
  const g = 5, a = 11, by = 2015; // 초5
  assert.equal(refineMatch(matchTarget(NOEUL, g, a, by), { detailTarget: '초등학교 4학년 이상 동반가족', titleTarget: '4학년 이상' }, g, a, by).match.result, 'match');
}

// ── 실제 사례 2: 도봉 "(초등생)" — 유치원생은 대상이 아님 ──
const DOBONG = '어린이(초등생포함가족)';
assert.deepEqual(run(DOBONG, { titleTarget: '초등생' }), { small: 'nomatch', big: 'match' });

// ── 실제 사례 3: 서울식물원 "/초등/" — 대상 칸은 "어린이" ──
assert.deepEqual(run('어린이', { titleTarget: '초등' }), { small: 'nomatch', big: 'match' }); // 유치원은 초등 대상이 아님
assert.deepEqual(run('어린이', { titleTarget: '유아' }), { small: 'match', big: 'nomatch' }); // "[유아/…]" 는 반대
assert.deepEqual(run('어린이', {}), { small: 'match', big: 'match' }); // 제목에서 못 읽으면 예전처럼 둘 다 해당

// ── 막아야 할 오작동 ──
// 상세 문구가 모호하면(학년·나이가 없으면) 대상 칸 판정을 바꾸지 않음
assert.deepEqual(run(NOEUL, { detailTarget: '가족 단위 참여' }), { small: 'match', big: 'match' });
// 대상 칸이 이미 "해당 안 됨"이면 상세 문구가 해당으로 뒤집지 않음
assert.equal(run('성인', { detailTarget: '초등학생 포함 가족' }).big, 'nomatch');
// 대상 칸이 "확인 필요"일 때는 상세 문구로 판정(예전 동작 유지)
assert.equal(run('', { detailTarget: '초등학교 4학년 이상' }).big, 'nomatch');
assert.equal(run('', { detailTarget: '초등 1~3학년' }).big, 'match');
console.log('refine.test.mjs OK');
