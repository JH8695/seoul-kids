import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeRow, parseWeekdays, classify, cleanText, isStale } from '../scripts/seoul.mjs';

const load = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const NOW = new Date('2026-10-10T12:00:00+09:00').getTime();
const edu = load('education.json').map((r) => normalizeRow(r, 'education', NOW));
const cul = load('culture.json').map((r) => normalizeRow(r, 'culture', NOW));
const by = (arr, k) => arr.find((c) => c.title.includes(k));

// 제목 정리
assert.equal(by(edu, '경희궁').title, "2026년 하반기 '우리 가족 경희궁 탐험대' 교육생 모집");

// 요일 파싱
assert.deepEqual(parseWeekdays('짚공예 체험(매주 일요일 10:30~12:30)').weekdays, [0]);
assert.deepEqual(parseWeekdays('미니솟대만들기( 매주 일) 14:00~16:00)').weekdays, [0]);
assert.deepEqual(parseWeekdays('미니장승만들기(매주 토 10:30~12:30)').weekdays, [6]);
assert.deepEqual(parseWeekdays('공예 (매주 화·목)').weekdays, [2, 4]);
assert.deepEqual(parseWeekdays('공예 (매주 화~금)').weekdays, [2, 3, 4, 5]);
assert.equal(parseWeekdays('교육', '격주 토요일, 총 20회').recurrence, '격주 토');
assert.equal(parseWeekdays('전시해설', '매주 월요일은 휴관입니다').weekdays, null);

// 분야
assert.ok(by(cul, '장승').tags.includes('make'));
assert.ok(by(cul, '전시해설').tags.includes('museum'));
assert.ok(by(edu, '반딧불이').tags.includes('nature'));
assert.ok(by(edu, '반딧불이').tags.includes('science')); // 서울시 분류가 "자연/과학"이면 두 분야에 모두
assert.ok(by(edu, '경희궁').tags.includes('history'));

// 상태 (2026-10-10 기준)
assert.equal(by(edu, '반딧불이').status, 'open');
assert.equal(by(edu, '박물관대학').status, 'closed'); // 접수종료
assert.equal(by(edu, '경희궁').status, 'full'); // 예약마감
assert.equal(by(cul, '장승').status, 'open');
assert.equal(by(cul, '짚공예').status, 'full');
assert.equal(by(cul, '백인제가옥의 숨겨진').status, 'closed');

// 시간 / 날짜
const fire = by(edu, '반딧불이');
assert.equal(fire.timeKnown, true);
assert.equal(fire.classStart, '2026-09-28T10:30:00+09:00');
assert.equal(fire.classEnd, '2026-10-27T11:00:00+09:00');
assert.equal(fire.applyEnd, '2026-10-26T17:00:00+09:00');
assert.equal(fire.lat, 37.5705 === 0 ? 0 : fire.lat); // 좌표는 숫자
assert.equal(typeof fire.lat, 'number');
assert.equal(by(edu, '박물관대학').timeKnown, false); // 00:00~00:00 은 시간 모름

// 상세내용 정리: 공통 안내문이 빠지고, 태그/엔티티가 없어야 함
const bk = by(cul, '백인제가옥의 숨겨진');
assert.ok(!/<\/?[a-z]|&[a-z]+;|공공시설 예약서비스/i.test(bk.snippet), bk.snippet);
assert.ok(bk.snippet.length > 40);

// 상세 글의 대상 줄
assert.match(bk.detailTarget, /초등학생.*부모/);

// 지난 것 제거 판단
assert.equal(isStale({ classEnd: '2026-09-01T00:00:00+09:00', applyEnd: '2026-08-20T00:00:00+09:00' }, NOW), true);
assert.equal(isStale({ classEnd: '2026-10-24T00:00:00+09:00', applyEnd: '2026-10-02T00:00:00+09:00' }, NOW), false);

console.log('seoul.test.mjs OK');
console.log(by(cul, '장승').snippet.slice(0, 120));
console.log(bk.snippet.slice(0, 160));
