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
console.log('placelist.test.mjs OK');
