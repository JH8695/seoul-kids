import assert from 'node:assert/strict';
import { buildExport, parseImport } from '../src/lib/backup.js';

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
console.log('backup.test.mjs OK');
