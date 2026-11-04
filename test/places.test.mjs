import assert from 'node:assert/strict';
import { placeKeyOf, placeName, shortPlaceName, cleanPlaces, withPlace, withPlaceMemo, placeMemoOf, placeState, listPlaces, withPlaceTimes, passesTravel, cleanTravel, placeTimesOf } from '../src/lib/places.js';
import { cleanSearches, addRecent, removeTerm, togglePin } from '../src/lib/searches.js';
import { updateSeen, isNewId, NEW_DAYS } from '../src/lib/firstSeen.js';

// 장소 열쇠: 띄어쓰기·대소문자 차이는 같은 장소
assert.equal(placeKeyOf({ area: '서초구', place: '서울 새활용플라자' }), placeKeyOf({ area: '서초구', place: '서울새활용플라자 ' }));
assert.notEqual(placeKeyOf({ area: '서초구', place: 'A도서관' }), placeKeyOf({ area: '강남구', place: 'A도서관' }));
assert.equal(placeKeyOf({ area: '서초구', place: '  ' }), null);
// 시설 안의 세부 위치는 같은 장소로 묶음
assert.equal(placeKeyOf({ area: '서초구', place: '서울새활용플라자 · 3층 강당' }), placeKeyOf({ area: '서초구', place: '서울 새활용플라자 > 꿈꾸는공장' }));
assert.equal(placeName({ place: '서울새활용플라자 · 3층 강당' }), '서울새활용플라자');

// 관심 ↔ 제외는 한 장소에 하나만
let p = withPlace({}, 'k1', '장소1', 'fav');
assert.equal(placeState(p, 'k1'), 'fav');
p = withPlace(p, 'k1', '장소1', 'hide');
assert.equal(placeState(p, 'k1'), 'hide');
assert.deepEqual(listPlaces(p, 'fav'), []);
assert.deepEqual(listPlaces(p, 'hide'), [{ key: 'k1', name: '장소1' }]);
p = withPlace(p, 'k1', '장소1', null);
assert.deepEqual(p, {});
assert.deepEqual(withPlace({ a: { s: 'fav', n: 'x' } }, null, 'n', 'hide'), { a: { s: 'fav', n: 'x' } }); // 열쇠가 없으면 변화 없음
// 이상한 값은 걸러냄
assert.deepEqual(cleanPlaces({ ok: { s: 'fav', n: '가' }, bad: { s: 'x' }, bad2: 3 }), { ok: { s: 'fav', n: '가' } });
assert.deepEqual(cleanPlaces([1, 2]), {});

// 검색어: 최근 10개, 같은 말은 맨 앞, 한 글자는 기록 안 함
let s = cleanSearches(null);
s = addRecent(s, '방배');
s = addRecent(s, '유아숲');
s = addRecent(s, '방배 ');
assert.deepEqual(s.recent, ['방배', '유아숲']);
assert.deepEqual(addRecent(s, '가').recent, ['방배', '유아숲']);
for (let i = 0; i < 12; i++) s = addRecent(s, `검색${i}`);
assert.equal(s.recent.length, 10);
assert.equal(s.recent[0], '검색11');
// 고정: 최근 목록에서 옮겨 가고, 밀려나지 않음. 고정한 말은 최근에 다시 쌓이지 않음
s = togglePin(s, '검색11');
assert.deepEqual(s.pinned, ['검색11']);
assert.ok(!s.recent.includes('검색11'));
for (let i = 20; i < 40; i++) s = addRecent(s, `검색${i}`);
assert.deepEqual(s.pinned, ['검색11']);
assert.deepEqual(addRecent(s, '검색11').recent, s.recent);
s = togglePin(s, '검색11'); // 해제하면 최근 맨 앞으로
assert.equal(s.recent[0], '검색11');
assert.deepEqual(s.pinned, []);
s = removeTerm(s, '검색11');
assert.ok(!s.recent.includes('검색11'));

// NEW: 처음 열 때 있던 것은 옛것, 이후 새로 올라온 것만 NEW
const t0 = Date.parse('2026-11-01T09:00:00+09:00');
let seen = updateSeen(null, ['a', 'b'], t0);
assert.equal(isNewId(seen, 'a', t0), false);
const t1 = t0 + 3 * 3600000;
seen = updateSeen(seen, ['a', 'b', 'c'], t1);
assert.equal(isNewId(seen, 'c', t1), true);
assert.equal(isNewId(seen, 'a', t1), false);
assert.equal(isNewId(seen, 'c', t1 + (NEW_DAYS + 1) * 86400000), false); // 3일이 지나면 NEW 가 아님
assert.equal(updateSeen(seen, ['a', 'b', 'c'], t1 + 1000), seen); // 변화 없으면 같은 객체(불필요한 저장 방지)
// 목록이 비어 읽힌 날(수집 실패)에는 기록을 지우지 않음
assert.equal(updateSeen(seen, [], t1 + 99 * 86400000), seen);
// 센터 메모: 관심·제외와 따로 저장(해제해도 메모는 남음), 비우면 지움
{
  let m = withPlaceMemo({}, 'k', '센터', '  지하철 25분 · 자차 15분 ');
  assert.equal(placeMemoOf(m, 'k'), '지하철 25분 · 자차 15분');
  assert.equal(placeState(m, 'k'), null); // 메모만 있어도 관심·제외는 아님
  assert.deepEqual(listPlaces(m, 'fav'), []);
  m = withPlace(m, 'k', '센터', 'fav');
  assert.equal(placeState(m, 'k'), 'fav');
  assert.equal(placeMemoOf(m, 'k'), '지하철 25분 · 자차 15분'); // 관심으로 정해도 메모 유지
  m = withPlace(m, 'k', '센터', null);
  assert.deepEqual(m, { k: { n: '센터', memo: '지하철 25분 · 자차 15분' } }); // 해제해도 메모는 남음
  m = withPlaceMemo(withPlace({}, 'k', '센터', 'hide'), 'k', '센터', '메모');
  m = withPlaceMemo(m, 'k', '센터', ''); // 메모만 지우면 제외 상태는 그대로
  assert.deepEqual(m, { k: { s: 'hide', n: '센터' } });
  assert.deepEqual(withPlaceMemo({ k: { n: '센터', memo: 'x' } }, 'k', '센터', ''), {}); // 둘 다 없으면 항목 삭제
  assert.equal(placeMemoOf(withPlaceMemo({}, 'k', 'n', 'a'.repeat(300)), 'k').length, 200); // 200자까지
  assert.deepEqual(cleanPlaces({ a: { n: 'A', memo: '메모만' }, b: { s: 'x', n: 'B' }, c: { s: 'fav', n: 'C', memo: '  ' } }), { a: { n: 'A', memo: '메모만' }, c: { s: 'fav', n: 'C' } });
}
// 화면용 짧은 이름: "서울특별시"와 "○○구"를 뺌 (센터 열쇠·저장 이름은 그대로)
assert.equal(shortPlaceName('서울특별시 동대문구 답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)'), '답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)');
assert.equal(shortPlaceName('서울특별시 동작구 노량진로 10 서울가족플라자 지하2층 (대방동)'), '노량진로 10 서울가족플라자 지하2층 (대방동)');
assert.equal(shortPlaceName('서울시 도봉구 해등로4길 38 초안산생태공원 내 위치 (창동)'), '해등로4길 38 초안산생태공원 내 위치 (창동)');
assert.equal(shortPlaceName('서울특별시 어린이대공원'), '어린이대공원'); // 구가 없으면 서울특별시만
assert.equal(shortPlaceName('강남구립도서관'), '강남구립도서관'); // 구 뒤에 공백이 없으면 이름의 일부
assert.equal(shortPlaceName('남산 팔각정'), '남산 팔각정');
assert.equal(shortPlaceName('서울특별시'), '서울특별시'); // 다 지우면 비니까 그대로
assert.equal(shortPlaceName(shortPlaceName('서울특별시 동대문구 답십리로66길 3')), '답십리로66길 3'); // 두 번 적용해도 같음
assert.equal(shortPlaceName(null), '');
console.log('places.test.mjs OK');

// 이동시간: 직접 입력한 분을 저장, 비우면 지움, 메모·관심은 그대로 유지
let t = withPlaceTimes({}, 'k2', '센터2', { tr: 25, cr: 15 });
assert.deepEqual(t.k2, { n: '센터2', tr: 25, cr: 15 });
assert.deepEqual(placeTimesOf(t, 'k2'), { tr: 25, cr: 15 });
t = withPlaceTimes(t, 'k2', '센터2', { tr: '' }); // 자차만 남김
assert.deepEqual(t.k2, { n: '센터2', cr: 15 });
t = withPlace(t, 'k2', '센터2', 'fav');
t = withPlaceMemo(t, 'k2', '센터2', '주차 가능');
assert.deepEqual(t.k2, { s: 'fav', n: '센터2', memo: '주차 가능', cr: 15 });
t = withPlace(t, 'k2', '센터2', null); // 관심 해제해도 메모·시간은 남음
assert.deepEqual(t.k2, { n: '센터2', memo: '주차 가능', cr: 15 });
t = withPlaceMemo(t, 'k2', '센터2', '');
assert.deepEqual(t.k2, { n: '센터2', cr: 15 });
t = withPlaceTimes(t, 'k2', '센터2', { cr: null });
assert.deepEqual(t, {}); // 아무것도 없으면 항목 삭제
// 이상한 값(0, 음수, 글자, 너무 큰 값)은 저장 안 함, 소수는 반올림
assert.deepEqual(withPlaceTimes({}, 'k3', 'x', { tr: 0, cr: -5 }), {});
assert.deepEqual(withPlaceTimes({}, 'k3', 'x', { tr: 'abc', cr: 601 }), {});
assert.deepEqual(withPlaceTimes({}, 'k3', 'x', { tr: 29.6 }).k3, { n: 'x', tr: 30 });
assert.deepEqual(cleanPlaces({ a: { n: '가', tr: 20 }, b: { n: '나', tr: 'x' } }), { a: { n: '가', tr: 20 } });
assert.equal(withPlaceTimes({}, null, 'x', { tr: 10 }) && Object.keys(withPlaceTimes({}, null, 'x', { tr: 10 })).length, 0);

// 이동시간 필터
const E = { tr: 25, cr: 35 };
assert.equal(passesTravel({ transit: null, car: null }, undefined), true); // 필터 없으면 전부 통과
assert.equal(passesTravel(undefined, undefined), true);
assert.equal(passesTravel({ transit: 30, car: null }, E), true); // 25분 ≤ 30분
assert.equal(passesTravel({ transit: 30, car: null }, { tr: 31 }), false);
assert.equal(passesTravel({ transit: 60, car: null }, { tr: 60 }), true); // 경계 포함
assert.equal(passesTravel({ transit: null, car: 20 }, E), false); // 35분 > 20분
assert.equal(passesTravel({ transit: null, car: 40 }, E), true);
assert.equal(passesTravel({ transit: 30, car: null }, { cr: 10 }), false); // 대중교통 시간을 안 적었으면 통과 못 함
assert.equal(passesTravel({ transit: 30, car: 20 }, { cr: 10 }), true); // 둘 다 고르면 하나라도 맞으면 통과
assert.equal(passesTravel({ transit: 30, car: 20 }, { tr: 50, cr: 30 }), false);
assert.equal(passesTravel({ transit: 30, car: null }, undefined), false); // 시간 미입력 센터
assert.deepEqual(cleanTravel({ transit: 45, car: 20 }), { transit: null, car: 20 }); // 정해진 값만 인정
assert.deepEqual(cleanTravel(null), { transit: null, car: null });
