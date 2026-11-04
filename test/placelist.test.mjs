import assert from 'node:assert/strict';
import { initialOf, buildPlaceList } from '../src/lib/placeList.js';
import { placeKeyOf } from '../src/lib/places.js';

assert.equal(initialOf('가락시장'), 'ㄱ');
assert.equal(initialOf('까치도서관'), 'ㄱ'); // 쌍자음은 ㄱ 칸
assert.equal(initialOf('서울숲'), 'ㅅ');
assert.equal(initialOf('쌍문'), 'ㅅ');
assert.equal(initialOf('N서울타워'), 'N');
assert.equal(initialOf('2호선박물관'), '#');
assert.equal(initialOf(''), '#');

const row = (area, place, groupKey, status, isNew = false) => ({ placeKey: placeKeyOf({ area, place }), course: { area, place }, groupKey, status, isNew });
const rows = [
  row('강남구', '대모산숲', 'g1', 'open'),
  row('강남구', '대모산숲', 'g1', 'upcoming'), // 같은 프로그램의 다른 회차 → 프로그램 1개, 접수중으로만 셈
  row('강남구', '대모산숲', 'g2', 'upcoming'),
  row('서초구', '서울새활용플라자 · 3층', 'g3', 'open', true),
  row('서초구', '서울새활용플라자 > 4층', 'g4', 'upcoming'), // 같은 시설로 묶임
  row('종로구', '가회동주민센터', 'g5', 'open'),
  row('종로구', '국립민속박물관', 'g6', 'open'),
  row('송파구', '쌍용도서관', 'g7', 'open'),
];
const keyOf = (area, place) => placeKeyOf({ area, place });

let r = buildPlaceList({ rows, places: {} });
assert.deepEqual(r.normal.map((b) => b.initial), ['ㄱ', 'ㄷ', 'ㅅ']); // 가회동·국립민속(ㄱ) / 대모산숲(ㄷ) / 서울새활용·쌍용(ㅅ)
const sup = r.normal.flatMap((b) => b.items).find((i) => i.name === '서울새활용플라자');
assert.equal(sup.programs, 2);
assert.equal(sup.open, 1);
assert.equal(sup.upcoming, 1);
assert.equal(sup.news, 1);
const dm = r.normal.flatMap((b) => b.items).find((i) => i.name === '대모산숲');
assert.deepEqual([dm.programs, dm.open, dm.upcoming], [2, 1, 1]);

// 관심 장소는 맨 위, 지금 올라온 게 없어도 목록에 있음. 제외 장소는 따로
const places = {
  [keyOf('강남구', '대모산숲')]: { s: 'fav', n: '대모산숲' },
  [keyOf('은평구', '없어진센터')]: { s: 'fav', n: '없어진센터' },
  [keyOf('송파구', '쌍용도서관')]: { s: 'hide', n: '쌍용도서관' },
};
r = buildPlaceList({ rows, places });
assert.deepEqual(r.fav.map((i) => i.name), ['대모산숲', '없어진센터']);
assert.equal(r.fav[1].programs, 0);
assert.deepEqual(r.hide.map((i) => i.name), ['쌍용도서관']);
assert.ok(!r.normal.flatMap((b) => b.items).some((i) => ['대모산숲', '쌍용도서관'].includes(i.name)));

// 이름 검색(띄어쓰기 무시)
r = buildPlaceList({ rows, places: {}, q: '새활용 플라자' });
assert.deepEqual(r.normal.flatMap((b) => b.items).map((i) => i.name), ['서울새활용플라자']);
// 센터 메모는 목록 항목에 붙음 (관심·제외가 아니어도, 프로그램이 있는 센터면 일반 목록에서 보임)
{
  const key = keyOf('서초구', '서울새활용플라자');
  const r2 = buildPlaceList({ rows, places: { [key]: { n: '서울새활용플라자', memo: '지하철 25분' } } });
  const it = r2.normal.flatMap((b) => b.items).find((i) => i.name === '서울새활용플라자');
  assert.equal(it.memo, '지하철 25분');
  assert.equal(it.state, null);
  // 지금 올라온 프로그램이 없고 메모만 있는 센터는 일반 목록에 안 나옴
  const r3 = buildPlaceList({ rows: [], places: { [keyOf('은평구', '없어진센터')]: { n: '없어진센터', memo: 'x' } } });
  assert.equal(r3.normal.length + r3.fav.length + r3.hide.length, 0);
}
// 주소 이름: "서울특별시 ○○구"를 뺀 이름으로 정렬·초성 (전부 ㅅ 하나로 몰리지 않음)
{
  const addr = (area, place, g) => row(area, place, g, 'open');
  const rows2 = [
    addr('동대문구', '서울특별시 동대문구 답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)', 'a'),
    addr('동작구', '서울특별시 동작구 노량진로 10 서울가족플라자 지하2층 (대방동)', 'b'),
    addr('도봉구', '서울특별시 도봉구 해등로4길 38 초안산생태공원 내 위치 (창동)', 'c'),
    addr('동작구', '서울특별시 동작구 상도로47아길 44-1 1층 (상도동)', 'd'),
  ];
  const r4 = buildPlaceList({ rows: rows2, places: {} });
  assert.deepEqual(r4.normal.map((b) => b.initial), ['ㄴ', 'ㄷ', 'ㅅ', 'ㅎ']); // 노량진로 / 답십리로 / 상도로 / 해등로
  assert.equal(r4.normal[1].items[0].name, '답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)');
  // 원래 이름(서울특별시…)·구 이름으로도 검색됨
  assert.equal(buildPlaceList({ rows: rows2, places: {}, q: '서울특별시 동작구' }).normal.flatMap((b) => b.items).length, 2);
  assert.equal(buildPlaceList({ rows: rows2, places: {}, q: '서울형키즈카페' }).normal.flatMap((b) => b.items).length, 1);
  assert.equal(buildPlaceList({ rows: rows2, places: {}, q: '도봉구' }).normal.flatMap((b) => b.items).length, 1);
  // 구 범위: 고른 구만 (관심·제외로 정해 둔 센터도 같은 범위로 거름)
  const only = (a) => a === '동작구';
  const r5 = buildPlaceList({ rows: rows2, places: {}, areaOk: only });
  assert.deepEqual(r5.normal.flatMap((b) => b.items).map((i) => i.area), ['동작구', '동작구']);
  const favKey = keyOf('도봉구', '서울특별시 도봉구 해등로4길 38 초안산생태공원 내 위치 (창동)');
  const r6 = buildPlaceList({ rows: [], places: { [favKey]: { s: 'fav', n: '서울특별시 도봉구 해등로4길 38 초안산생태공원 내 위치 (창동)' } }, areaOk: only });
  assert.equal(r6.fav.length, 0); // 다른 구의 관심 센터는 이 범위에서 안 보임
  const r7 = buildPlaceList({ rows: [], places: { [favKey]: { s: 'fav', n: '서울특별시 도봉구 해등로4길 38 초안산생태공원 내 위치 (창동)' } } });
  assert.equal(r7.fav[0].name, '해등로4길 38 초안산생태공원 내 위치 (창동)');
}
{
  // 센터 목록의 이동시간 필터
  const mk = (area, place, id) => ({ placeKey: placeKeyOf({ area, place }), course: { place, area }, groupKey: id, status: 'open', isNew: false });
  const rows = [mk('강남구', 'A센터', 'g1'), mk('서초구', 'B센터', 'g2'), mk('용산구', 'C센터', 'g3')];
  const places = { [placeKeyOf({ area: '강남구', place: 'A센터' })]: { n: 'A센터', tr: 25, cr: 35 }, [placeKeyOf({ area: '서초구', place: 'B센터' })]: { n: 'B센터', tr: 50, cr: 15 } };
  const names = (r) => [...r.fav, ...r.normal.flatMap((b) => b.items)].map((i) => i.name).sort();
  assert.deepEqual(names(buildPlaceList({ rows, places })), ['A센터', 'B센터', 'C센터']); // 필터 없음
  assert.deepEqual(names(buildPlaceList({ rows, places, travel: { transit: null, car: null } })), ['A센터', 'B센터', 'C센터']);
  assert.deepEqual(names(buildPlaceList({ rows, places, travel: { transit: 30, car: null } })), ['A센터']);
  assert.deepEqual(names(buildPlaceList({ rows, places, travel: { transit: null, car: 20 } })), ['B센터']);
  assert.deepEqual(names(buildPlaceList({ rows, places, travel: { transit: 30, car: 20 } })), ['A센터', 'B센터']); // 하나라도 맞으면
  assert.deepEqual(names(buildPlaceList({ rows, places, unsetOnly: true })), ['C센터']); // 시간 미입력만
  // 관심 센터도 같은 필터를 따름
  const fav = { ...places, [placeKeyOf({ area: '용산구', place: 'C센터' })]: { s: 'fav', n: 'C센터' } };
  assert.equal(buildPlaceList({ rows, places: fav, travel: { transit: 30, car: null } }).fav.length, 0);
  assert.equal(buildPlaceList({ rows, places: fav, unsetOnly: true }).fav.length, 1);
}
console.log('placelist.test.mjs OK');
