import assert from 'node:assert/strict';
import { SYNC_KEYS, bumpStamps, mergeUnion, pickSync, reconcile, signature } from '../src/lib/sync.js';

const S = (over = {}, stamps = {}) => ({
  kids: [{ id: 'k1', label: 'a', birthYear: 2020 }], activeKids: [], areas: ['강남구'], days: [],
  favs: [], hidden: [], hiddenRounds: [], notes: {}, _stamps: stamps, ...over,
});
const R = (over = {}, stamps = {}) => ({ data: pickSync(S(over)), stamps });

// ---- bumpStamps: 바뀐 항목만 시각 갱신 ----
{
  const prev = S({ favs: ['a'] }, { favs: 1 });
  const next = bumpStamps(prev, { ...prev, favs: ['a', 'b'], hidden: ['x'] }, 100);
  assert.equal(next._stamps.favs, 100);
  assert.equal(next._stamps.hidden, 100);
  assert.equal(next._stamps.notes, undefined);
  const nochange = bumpStamps(prev, { ...prev }, 200);
  assert.equal(nochange._stamps.favs, 1); // 안 바뀌면 그대로
}

// ---- 서버에 문서가 없을 때: 내 것을 올림 ----
{
  const r = reconcile(S({ favs: ['a'] }), null, { now: 50 });
  assert.deepEqual(r.values.favs, ['a']);
  assert.equal(r.remoteChanged, true);
  assert.equal(r.localChanged, false);
  assert.equal(r.stamps.favs, 50);
}

// ---- 평소: 항목별로 나중에 고친 쪽이 이김 ----
{
  const local = S({ favs: ['a'], hidden: ['h1'] }, { favs: 10, hidden: 30 });
  const remote = R({ favs: ['a', 'b'], hidden: [] }, { favs: 20, hidden: 5, notes: 1, kids: 1, activeKids: 1, areas: 1, days: 1, hiddenRounds: 1 });
  const r = reconcile(local, remote, { now: 99 });
  assert.deepEqual(r.values.favs, ['a', 'b']); // 서버가 더 최근
  assert.deepEqual(r.values.hidden, ['h1']); // 내 기기가 더 최근
  assert.equal(r.localChanged, true);
  assert.equal(r.remoteChanged, true); // 서버에도 내 hidden 을 올려야 함
}

// ---- 지운 것이 되살아나지 않음 ----
{
  const local = S({ favs: [] }, { favs: 200 }); // PC 에서 찜 해제(나중)
  const remote = R({ favs: ['a'] }, { favs: 100 });
  const r = reconcile(local, remote);
  assert.deepEqual(r.values.favs, []);
  const back = reconcile(S({ favs: ['a'] }, { favs: 100 }), { data: { ...pickSync(S()), favs: [] }, stamps: { favs: 200 } });
  assert.deepEqual(back.values.favs, []); // 반대쪽 기기에도 해제가 전달됨
}

// ---- 같은 시각이면 서버 것을 따름 ----
{
  const r = reconcile(S({ favs: ['x'] }, { favs: 5 }), R({ favs: ['y'] }, { favs: 5 }));
  assert.deepEqual(r.values.favs, ['y']);
}

// ---- 처음 연결: 찜·숨김·메모는 합침 ----
{
  const local = S({ favs: ['a'], hidden: ['h1'], notes: { S1: { text: '폰 메모', dates: [] } }, areas: ['서초구'] });
  const remote = R({ favs: ['b'], hidden: ['h2'], notes: { S2: { text: 'PC 메모', dates: [] } }, areas: ['송파구'] });
  const r = reconcile(local, remote, { firstLink: true, now: 7 });
  assert.deepEqual(r.values.favs.sort(), ['a', 'b']);
  assert.deepEqual(r.values.hidden.sort(), ['h1', 'h2']);
  assert.deepEqual(Object.keys(r.values.notes).sort(), ['S1', 'S2']);
  assert.deepEqual(r.values.areas, ['송파구']); // 취향 설정은 계정 쪽
  assert.equal(r.stamps.favs, 7);
  // 같은 예약에 양쪽 메모가 있으면 내 기기 것
  const both = reconcile(S({ notes: { S1: { text: '내 것', dates: [] } } }), R({ notes: { S1: { text: '서버 것', dates: [] } } }), { firstLink: true });
  assert.equal(both.values.notes.S1.text, '내 것');
}

// ---- 링크로 합치기: 취향은 내 기기 유지 ----
{
  const m = mergeUnion(pickSync(S({ favs: ['a'], areas: ['서초구'] })), pickSync(S({ favs: ['b'], areas: ['송파구'] })), { prefs: 'local' });
  assert.deepEqual(m.favs.sort(), ['a', 'b']);
  assert.deepEqual(m.areas, ['서초구']);
}

// ---- 수렴: 합친 결과를 다시 합쳐도 변하지 않음 ----
{
  const local = S({ favs: ['a'], hidden: ['h1'] }, { favs: 10, hidden: 30 });
  const remote = R({ favs: ['a', 'b'] }, { favs: 20 });
  const r1 = reconcile(local, remote, { now: 99 });
  const afterLocal = { ...local, ...r1.values, _stamps: r1.stamps };
  const afterRemote = { data: r1.values, stamps: r1.stamps };
  const r2 = reconcile(afterLocal, afterRemote, { now: 150 });
  assert.equal(r2.localChanged, false);
  assert.equal(r2.remoteChanged, false);
  assert.equal(signature(r2.values, r2.stamps), signature(r1.values, r1.stamps));
}

// ---- 서버 문서에 없는 항목은 내 것을 유지 ----
{
  const remote = { data: { favs: ['z'] }, stamps: { favs: 50 } };
  const r = reconcile(S({ hidden: ['h'] }, { hidden: 1 }), remote);
  assert.deepEqual(r.values.hidden, ['h']);
  assert.deepEqual(r.values.favs, ['z']);
}

assert.equal(SYNC_KEYS.length, 8);
console.log('sync.test.mjs OK');
