import assert from 'node:assert/strict';
import { titleInfo, extractTitleTarget, isOnline, stripTitle, groupKeyOf, chipLabel, isStanding, parseNthWeeks } from '../src/lib/title.js';

const C = (title, start, end, extra = {}) => ({
  title, classStart: `${start}T00:00:00+09:00`, classEnd: `${end}T00:00:00+09:00`, place: '온라인', targetText: '제한없음(서울시민 누구나)', ...extra,
});

// ---- 날짜 ----
let t = titleInfo(C('[12월 온라인] 2026 대시민 정비사업 아카데미(12/7)', '2026-10-06', '2026-12-07'));
assert.deepEqual(t.dates, ['2026-12-07']);
t = titleInfo(C('[12월 온라인] 2026 대시민 정비사업 아카데미(12/2)', '2026-10-06', '2026-12-02'));
assert.deepEqual(t.dates, ['2026-12-02']);
t = titleInfo(C('[10월] 2026 대시민 정비사업 아카데미 2차 (10/20 성동구)', '2026-10-01', '2026-10-20'));
assert.deepEqual(t.dates, ['2026-10-20']);
t = titleInfo(C('체험 12월 7일 오후', '2026-10-06', '2026-12-31'));
assert.deepEqual(t.dates, ['2026-12-07']);
// 해를 넘기는 기간
t = titleInfo(C('겨울 숲 (1/10)', '2026-12-20', '2027-01-31'));
assert.deepEqual(t.dates, ['2027-01-10']);
// 이용 기간 밖의 숫자는 날짜로 보지 않음
t = titleInfo(C('접수 안내 (9/1)', '2026-10-01', '2026-10-31'));
assert.equal(t.dates, null);
// 숫자들
t = titleInfo(C('초등 1~3학년 물방울', '2026-09-09', '2026-12-12'));
assert.equal(t.dates, null);
assert.equal(t.intervals, null);

// ---- 날짜 코드 (YYMMDD) ----
t = titleInfo(C('[부여서울농장] 가을로 물든 부여에서 수확의 기쁨 (261023)', '2026-10-23', '2026-10-24'));
assert.deepEqual(t.dates, ['2026-10-23']);
t = titleInfo(C('[부여서울농장] 가을로 물든 부여에서 수확의 기쁨 (261024)', '2026-10-23', '2026-10-24'));
assert.deepEqual(t.dates, ['2026-10-24']);
// 이용 기간 밖이거나 없는 날짜면 날짜로 보지 않음
assert.equal(titleInfo(C('체험 (261231)', '2026-10-23', '2026-10-24')).dates, null);
assert.equal(titleInfo(C('체험 (260230)', '2026-02-01', '2026-03-30')).dates, null);
assert.equal(titleInfo(C('체험 (123456)', '2026-10-23', '2026-10-24')).dates, null);

// ---- 월 ----
t = titleInfo(C('(10월) 속닥속닥 세곡천 (휴일, 토)', '2026-09-15', '2026-10-31'));
assert.deepEqual(t.intervals, [['2026-10-01', '2026-10-31']]);
assert.deepEqual(t.weekdays, [6]); // "휴일"보다 적힌 요일(토)이 우선
t = titleInfo(C('[광진구] 아차산 치유의 숲길- 10월 산림치유 프로그램(토)- 가족', '2026-10-01', '2026-10-31'));
assert.deepEqual(t.weekdays, [6]);
assert.deepEqual(t.intervals, [['2026-10-01', '2026-10-31']]);
t = titleInfo(C('가을 체험 9월~10월', '2026-09-15', '2026-12-31'));
assert.deepEqual(t.intervals, [['2026-09-15', '2026-09-30'], ['2026-10-01', '2026-10-31']]);

// ---- 요일 ----
assert.deepEqual(titleInfo(C('(목, 금요일) 방이생태학습관 스마트팜 체험', '2026-10-01', '2026-10-31')).weekdays, [4, 5]);
assert.deepEqual(titleInfo(C('(목, 금요일) 방이생태학습관', '2026-10-01', '2026-10-31')).weekdays, [4, 5]);
assert.deepEqual(titleInfo(C('[주말/토 오후/초등 1~3학년]물방울의 변신', '2026-09-09', '2026-12-12')).weekdays, [6]);
assert.deepEqual(titleInfo(C('뵈아리 수호대(주말)', '2026-09-09', '2026-12-12')).weekdays, [0, 6]);
assert.deepEqual(titleInfo(C('공예 (월~금)', '2026-09-09', '2026-12-12')).weekdays, [1, 2, 3, 4, 5]);
assert.deepEqual(titleInfo(C('짚공예 체험(매주 일요일 10:30~12:30)', '2026-03-09', '2026-10-25')).weekdays, [0]);
assert.deepEqual(titleInfo(C('휴일 숲체험(휴일)', '2026-09-09', '2026-12-12')).weekdays, [0]);
// 요일이 아닌 한 글자들은 무시
assert.equal(titleInfo(C('일반 시민 월 1회 교육 (수료증)', '2026-09-09', '2026-12-12')).weekdays, null);
assert.equal(titleInfo(C('서울숲 곤충 탐사', '2026-09-09', '2026-12-12')).weekdays, null);

// 앞말에 붙은 "주말"
assert.deepEqual(titleInfo(C('광진구숲해설-가족주말(서울형정원처방)(10월)', '2026-10-04', '2026-10-31')).weekdays, [0, 6]);
assert.equal(titleInfo(C('주말농장 체험', '2026-10-04', '2026-10-31')).weekdays, null);

// ---- 학년 ----
assert.match(extractTitleTarget('[주말/토 오후/초등 1~3학년]물방울의 변신'), /초등 1~3학년/);
assert.match(extractTitleTarget('초3~초6 코딩'), /초3/);
assert.match(extractTitleTarget('만 5~7세 숲놀이'), /5~7세/);
assert.equal(extractTitleTarget('서울숲 곤충 탐사 2026'), null);

// ---- 온라인 ----
assert.equal(isOnline({ title: '[12월 온라인] 아카데미', place: '온라인' }), true);
assert.equal(isOnline({ title: '숲 체험', place: '서울숲' }), false);

// ---- 묶기 ----
const base = { place: '온라인', targetText: '제한없음(서울시민 누구나)' };
const k = (title, extra = {}) => groupKeyOf({ ...base, title, ...extra });
assert.equal(k('[12월 온라인] 2026 대시민 정비사업 아카데미(12/7)'), k('[12월 온라인] 2026 대시민 정비사업 아카데미(12/2)'));
assert.equal(k('[12월 온라인] 2026 대시민 정비사업 아카데미(12/7)'), k('[12월 온라인] 2026 대시민 정비사업 아카데미(12/8)'));
assert.equal(k('(10월) 속닥속닥 세곡천 (휴일, 토)'), k('(11월) 속닥속닥 세곡천 (휴일,토)'));
assert.notEqual(k('(10월) 속닥속닥 세곡천 (휴일, 토)'), k('(10월) 속닥속닥 양재천 (휴일, 토)'));
// 대상이 다르면 다른 프로그램 (같은 제목이어도)
assert.notEqual(
  groupKeyOf({ title: '[광진구] 아차산 치유의 숲길- 10월 산림치유 프로그램(토)', place: 'a', targetText: '가족' }),
  groupKeyOf({ title: '[광진구] 아차산 치유의 숲길- 10월 산림치유 프로그램(토)', place: 'a', targetText: '제한없음(대상:사회적 배려자-일정조율가능)' }),
);
// "(10/20 성동구)"처럼 날짜 옆에 다른 말이 붙어도 날짜만 떼고 묶임
assert.equal(stripTitle('[10월] 정비사업 아카데미 2차 (10/20 성동구)'), stripTitle('[10월] 정비사업 아카데미 2차 (10/27 성동구)'));

// 날짜 코드만 다른 회차는 한 프로그램으로 묶임
assert.equal(
  k('[부여서울농장] 가을로 물든 부여에서 수확의 기쁨 (261023)', { place: '부여서울농장', targetText: '가족' }),
  k('[부여서울농장] 가을로 물든 부여에서 수확의 기쁨 (261024)', { place: '부여서울농장', targetText: '가족' }),
);

// ---- 칩 이름 ----
assert.equal(chipLabel(C('a(12/7)', '2026-10-06', '2026-12-07'), titleInfo(C('a(12/7)', '2026-10-06', '2026-12-07'))), '12/7(월)');
assert.equal(chipLabel(C('(10월) 세곡천 (휴일, 토)', '2026-09-15', '2026-10-31'), titleInfo(C('(10월) 세곡천 (휴일, 토)', '2026-09-15', '2026-10-31'))), '10월 토');

// ---- 개월 ----
assert.match(extractTitleTarget('[12~24개월] 아기 놀이'), /12~24개월/);

// ---- 상시 운영 ----
const S = (title, start, end, from, to, extra = {}) => ({
  title, classStart: `${start}T${from}:00+09:00`, classEnd: `${end}T${to}:00+09:00`, timeKnown: true, ...extra,
});
const st = (c) => isStanding(c, titleInfo(c));
assert.equal(st(S('서울형 키즈카페 한성백제박물관점 10월 운영 안내', '2026-10-01', '2026-10-30', '09:30', '17:30')), true);
assert.equal(st(S('2026 백인제가옥 전시해설 예약', '2026-10-01', '2026-10-31', '10:00', '17:00')), true);
assert.equal(st(S('어린이 상설 체험 프로그램', '2026-10-01', '2026-10-31', '10:00', '12:00')), true);
// 행사는 상시 운영이 아님
assert.equal(st(S('(10월) 속닥속닥 세곡천 (휴일, 토)', '2026-09-15', '2026-10-31', '10:00', '15:30')), false);
assert.equal(st(S('서울숲 곤충탐사 (10/18)', '2026-10-18', '2026-10-18', '10:00', '17:00')), false);
assert.equal(st(S('미니장승만들기(매주 토 10:30~12:30)', '2026-03-09', '2026-10-31', '10:30', '12:30')), false);
assert.equal(st(S('[월드컵공원] 반딧불이 해설(10월)', '2026-09-28', '2026-10-27', '10:30', '11:00')), false);
assert.equal(st(S('짧은 행사', '2026-10-01', '2026-10-05', '09:00', '18:00')), false); // 기간이 짧음
assert.equal(st(S('종일 체험', '2026-10-01', '2026-10-31', '00:00', '23:59', { timeKnown: false })), false); // 시간을 모르면 판단 안 함

// 수시·상시·평일 매일
assert.equal(st(S('성동구_금호산유아숲체험원 수시 모집 (주중/평일/오후반)', '2026-09-01', '2026-11-30', '13:30', '15:00')), true);
assert.equal(st(S('숲 체험 연중 모집', '2026-09-01', '2026-11-30', '10:00', '11:00')), true);
assert.equal(st(S('정규 수업 (월~금)', '2026-09-01', '2026-11-30', '10:00', '11:00')), true);
assert.equal(st(S('(토) 체험', '2026-09-01', '2026-11-30', '10:00', '11:00')), false);
assert.equal(st(S('정규 수업 (월~금)', '2026-10-01', '2026-10-10', '10:00', '11:00')), false); // 기간이 짧음

// 연간 · 서울형 키즈카페
assert.equal(st(S('[연간/6세 이상~성인]서울하수도과학관 2026년 전시해설 프로그램', '2026-01-02', '2026-12-19', '10:00', '11:00')), true);
assert.equal(st(S('서울형 키즈카페 강남구 역삼1동점', '2026-10-01', '2026-10-31', '10:00', '12:00')), true);
assert.equal(st(S('강남구 대치1동점', '2026-10-01', '2026-10-31', '10:00', '12:00', { category: '서울형키즈카페' })), true);
assert.equal(st(S('강남구 잠원한강공원 놀이터', '2026-10-01', '2026-10-31', '10:00', '12:00', { place: '서울형 키즈카페 잠원점' })), true);
assert.equal(st(S('숲 체험 (10/17)', '2026-10-17', '2026-10-17', '10:00', '12:00')), false);

// ---- "9~11월" 범위 ----
t = titleInfo(C('[송파책박물관] [유아(6-7세] 요리조리, 우리는 책 요리사! (9~11월)', '2026-09-05', '2026-11-28'));
assert.deepEqual(t.intervals, [['2026-09-05', '2026-09-30'], ['2026-10-01', '2026-10-31'], ['2026-11-01', '2026-11-28']]);
assert.equal(titleInfo(C('유아(6-7세) 체험 11월', '2026-09-05', '2026-11-28')).intervals.length, 1); // "6-7세"는 월 범위가 아님

// ---- 몇째 주 무슨 요일 ----
assert.deepEqual(parseNthWeeks('[성북구] 산림치유 10월 북한산 태교숲(1,3주 일요일 오후) 쓰담쓰담'), { weeks: [1, 3], weekdays: [0] });
assert.deepEqual(parseNthWeeks('[성북구] 태교숲(2주 일 오후) 쑥쑥'), { weeks: [2], weekdays: [0] });
assert.deepEqual(parseNthWeeks('매월 2,3째주 토요일 오전'), { weeks: [2, 3], weekdays: [6] });
assert.deepEqual(parseNthWeeks('요일 및 시간 토요일 2,3주 오전 10시~12시'), { weeks: [2, 3], weekdays: [6] });
assert.deepEqual(parseNthWeeks('첫째, 셋째 주 수요일'), { weeks: [1, 3], weekdays: [3] });
assert.equal(parseNthWeeks('4주간 토요일마다 진행'), null); // 기간(4주 동안)이지 넷째 주가 아님
assert.equal(parseNthWeeks('4주 과정 토요일'), null);
assert.equal(parseNthWeeks('매주 토요일 10시'), null);
assert.equal(parseNthWeeks('휴관일 : 매월 첫째 주 월요일'), null); // 쉬는 날
assert.equal(parseNthWeeks('둘째 주 월요일은 휴관입니다'), null);
// 제목의 몇째 주는 weekdays 와 weekOfMonth 로
t = titleInfo(C('[성북구] 태교숲(1,3주 일요일 오후)', '2026-10-01', '2026-10-31'));
assert.deepEqual(t.weekdays, [0]);
assert.deepEqual(t.weekOfMonth, [1, 3]);

// ---- 상시: 반년 이상 날짜·요일 없음 / 몇째 주는 상시 아님 ----
assert.equal(st(S('아리수나라 어린이 체험 예약', '2024-07-01', '2026-11-30', '09:30', '17:40')), true);
assert.equal(st({ ...S('체험관 이용', '2026-01-01', '2026-12-31', '10:00', '11:00'), timeKnown: false }), true);
assert.equal(st(S('(10월) 세곡놀이터', '2026-01-01', '2026-12-31', '10:00', '11:00')), false); // 제목에 달이 있음
assert.equal(st({ ...S('숲 치유', '2026-05-25', '2026-11-21', '10:00', '12:00'), weekOfMonth: [2, 3], weekdays: [6] }), false);

console.log('title.test.mjs OK');
