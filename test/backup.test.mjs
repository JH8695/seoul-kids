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
