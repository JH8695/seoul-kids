import assert from 'node:assert/strict';
import { buildExport, parseImport, buildShareLink, parseShareHash } from '../src/lib/backup.js';

const settings = {
  kids: [{ id: 'k1', label: '작은아이', birthYear: 2020 }],
  activeKids: [], areas: ['강남구'], days: [6], favs: ['a|b|c'], hidden: ['x|y|z'], hiddenRounds: ['S1'],
  notes: { S2: { text: '친구랑', dates: ['2026-10-17'] } }, 쓸데없는: 1,
};
const text = buildExport(settings);
const r = parseImport(text);
assert.ok(r.settings);
assert.deepEqual(r.settings.notes, settings.notes);
assert.deepEqual(r.settings.hiddenRounds, ['S1']);
assert.equal(r.settings.쓸데없는, undefined);
assert.ok(parseImport('아무 글').error);
assert.ok(parseImport('{"app":"other","settings":{}}').error);
assert.ok(parseImport('{"app":"seoul-kids","v":1,"settings":{"favs":"nope"}}').error);
assert.ok(parseImport('{"app":"seoul-kids","v":1,"settings":{"days":[9]}}').error);
assert.ok(parseImport('{"app":"seoul-kids","v":1,"settings":{"kids":[]}}').error);
// 합치기 링크: 한글 메모도 그대로 돌아옴
const link = buildShareLink(settings, 'https://example.github.io/seoul-kids/');
assert.ok(link.includes('#import='));
assert.ok(!/[+/=]/.test(link.split('#import=')[1])); // 주소에 안전한 글자만
const back = parseShareHash('#' + link.split('#')[1]);
assert.deepEqual(back.settings.notes, settings.notes);
assert.deepEqual(back.settings.favs, settings.favs);
assert.ok(parseShareHash('#import=@@@').error);
assert.ok(parseShareHash('#other').error);
console.log('backup.test.mjs OK');

// 갈 수 없는 시간 · 관심/제외 장소 · 검색어도 내보내기/가져오기에 포함
{
  const settings = {
    kids: [{ id: 'k1', label: '큰아이', birthYear: 2017 }],
    busy: [{ id: 'a', days: [6], start: '10:00', end: '11:50' }],
    places: { '강남구|과학관': { s: 'hide', n: '과학관' } },
    searches: { recent: ['방배'], pinned: ['유아숲'] },
  };
  const r = parseImport(buildExport(settings));
  assert.deepEqual(r.settings.busy, settings.busy);
  assert.deepEqual(r.settings.places, settings.places);
  assert.deepEqual(r.settings.searches, settings.searches);
  // 이상한 값은 걸러내고 앱이 깨지지 않게
  const bad = parseImport(JSON.stringify({ app: 'seoul-kids', v: 1, settings: { busy: [{ days: [], start: 'x', end: 'y' }], places: { a: { s: 'zzz' } }, searches: { recent: [1, 'ok'] } } }));
  assert.deepEqual(bad.settings.busy, []);
  assert.deepEqual(bad.settings.places, {});
  assert.deepEqual(bad.settings.searches, { recent: ['1', 'ok'], pinned: [] });
  assert.ok(parseImport(JSON.stringify({ app: 'seoul-kids', v: 1, settings: { busy: 'x' } })).error);
}
{
  const r = parseImport(buildExport({ kids: [{ id: 'k1', label: '큰아이', birthYear: 2017 }], scope: 'all' }));
  assert.equal(r.settings.scope, 'all');
  assert.equal(parseImport(JSON.stringify({ app: 'seoul-kids', v: 1, settings: { scope: 'zzz' } })).settings.scope, 'near');
}
{
  const r = parseImport(buildExport({ kids: [{ id: 'k1', label: '큰아이', birthYear: 2017 }], hideWords: ['서울형키즈카페', ' '] }));
  assert.deepEqual(r.settings.hideWords, ['서울형키즈카페']);
}
{
  const r = parseImport(buildExport({ kids: [{ id: 'k1', label: '큰아이', birthYear: 2017 }], placesScope: '동작구' }));
  assert.equal(r.settings.placesScope, '동작구');
  assert.equal(parseImport(JSON.stringify({ app: 'seoul-kids', v: 1, settings: { placesScope: 5 } })).settings.placesScope, null);
}
console.log('backup extra OK');
