import assert from 'node:assert/strict';
import { inferArea } from '../src/lib/inferArea.js';
import { normalizeRow } from '../scripts/seoul.mjs';

// 실제 사례: 한양도성 성벽흔적구간 — 구 칸이 비어 "구 미표기"로 나왔음
const title = '(주말)해설이 있는 한양도성_성벽흔적구간(성북권역)';
assert.equal(inferArea('', { title, place: '한성대입구역 5번출구(지하철역사 내)' }), '성북구');
// 구가 아닌 권역(인왕권역 등)은 추측하지 않음
assert.equal(inferArea('', { title: '(주말)해설이 있는 한양도성_성벽흔적구간_인왕권역', place: '인왕산 ' }), '');
// 서울시 구 칸이 이미 구면 그대로
assert.equal(inferArea('강남구', { title, place: '성북구 어딘가' }), '강남구');
// 장소 이름 안의 구
assert.equal(inferArea('', { place: '서울특별시 동대문구 답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)' }), '동대문구');
assert.equal(inferArea('서울시', { place: '마포구 어린이도서관' }), '마포구'); // 구가 아닌 값도 대체
// 구가 둘 이상이면 어느 쪽인지 몰라서 비워 둠
assert.equal(inferArea('', { place: '강남구 · 서초구 일대' }), '');
// 상세내용은 "장소" 같은 말 뒤의 구만 — 주최·문의처의 구(서울시청 중구)는 무시
assert.equal(inferArea('', { detail: 'ㅇ출발장소 : 서울특별시 성북구 삼선교로 한성대입구역 5번 출구 ㅇ주최 : 서울특별시 중구 세종대로 110' }), '성북구');
assert.equal(inferArea('', { detail: 'ㅇ주최 : 서울특별시 중구 세종대로 110 ㅇ문의 : 02-120' }), '');
assert.equal(inferArea('', { detail: 'ㅇ출발장소 : 지하철 4호선 한성대입구역 5번 출구' }), ''); // 구 이름이 없으면 비움
// "○○구"가 다른 낱말의 일부일 때는 걸리지 않음
assert.equal(inferArea('', { place: '신서초구역 센터' }), '');
assert.equal(inferArea('', { place: '서초구립 방배도서관' }), '서초구');
assert.equal(inferArea(undefined, {}), '');
// 데이터 변환 전체: 구 칸이 빈 서울시 데이터 한 줄 → 성북구
{
  const row = { SVCID: 'S261019202311516170', SVCNM: title, SVCSTATNM: '접수중', PLACENM: '한성대입구역 5번출구(지하철역사 내)', AREANM: '', MAXCLASSNM: '문화체험', MINCLASSNM: '문화행사',
    USETGTINFO: '가족(초등1학년 이상), 성인', SVCOPNBGNDT: '2026-11-08 00:00:00.0', SVCOPNENDDT: '2026-11-22 00:00:00.0', RCPTBGNDT: '2026-10-20 10:00:00.0', RCPTENDDT: '2026-11-19 17:00:00.0',
    V_MIN: '10:00', V_MAX: '11:20', DTLCONT: '<p>ㅇ운영일시 : 26. 11.8(일)/11.22(일) 10:00-11:20</p><p>ㅇ출발장소 : 지하철 4호선 한성대입구역 5번 출구</p>' };
  const c = normalizeRow(row, 'culture', Date.parse('2026-11-01T00:00:00+09:00'));
  assert.equal(c.area, '성북구');
  assert.equal(normalizeRow({ ...row, AREANM: '종로구' }, 'culture', Date.parse('2026-11-01T00:00:00+09:00')).area, '종로구'); // 서울시가 적어 준 구는 그대로
}
console.log('area.test.mjs OK');
