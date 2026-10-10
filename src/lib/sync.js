// 두 기기(폰·PC)의 설정·찜·숨김·메모를 합치는 규칙. 네트워크를 쓰지 않는 순수 함수만 있어요.
//
// 항목(키)마다 "마지막으로 고친 시각(stamp)"을 따로 기록해서:
//   - 평소: 항목별로 나중에 고친 쪽을 따라요 (지운 것도 지운 대로 반영돼요)
//   - 처음 계정에 연결할 때: 찜·숨김·메모는 양쪽 것을 합쳐요 (한쪽이 다른 쪽을 덮어써서 사라지지 않게)
export const SYNC_KEYS = ['kids', 'activeKids', 'areas', 'days', 'favs', 'hidden', 'hiddenRounds', 'notes'];
const LIST_KEYS = ['favs', 'hidden', 'hiddenRounds']; // 합칠 때 합집합으로
const PREF_KEYS = ['kids', 'activeKids', 'areas', 'days']; // 개인 취향 설정

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function pickSync(settings) {
  const out = {};
  for (const k of SYNC_KEYS) out[k] = settings[k] ?? (k === 'notes' ? {} : []);
  return out;
}

/** setSettings 때마다: 값이 바뀐 항목의 시각만 갱신 */
export function bumpStamps(prev, next, now = Date.now()) {
  const stamps = { ...(next._stamps ?? prev._stamps ?? {}) };
  let changed = false;
  for (const k of SYNC_KEYS) {
    if (!same(prev[k], next[k])) { stamps[k] = now; changed = true; }
  }
  return changed || next._stamps !== stamps ? { ...next, _stamps: stamps } : next;
}

/**
 * 합집합: 찜·숨김은 양쪽 항목을 모두, 메모는 양쪽 메모를 모두(같은 예약이면 local 이 이김).
 * prefs: 'remote' 면 아이·구·요일 설정은 remote 것을 따르고(계정 쪽), 'local' 이면 내 기기 것을 유지
 */
export function mergeUnion(local, remote, { prefs = 'remote' } = {}) {
  const out = {};
  for (const k of LIST_KEYS) out[k] = [...new Set([...(remote[k] ?? []), ...(local[k] ?? [])])];
  out.notes = { ...(remote.notes ?? {}), ...(local.notes ?? {}) };
  for (const k of PREF_KEYS) {
    const useRemote = prefs === 'remote' && remote[k] !== undefined;
    out[k] = useRemote ? remote[k] : local[k] ?? remote[k] ?? [];
  }
  return out;
}

/**
 * 내 기기(local)와 서버 문서(remote)를 합침.
 * @param local   현재 설정 (_stamps 포함)
 * @param remote  { data, stamps } 또는 null (서버에 아직 없음)
 * @returns { values, stamps, localChanged, remoteChanged }
 */
export function reconcile(local, remote, { firstLink = false, now = Date.now() } = {}) {
  const lv = pickSync(local);
  const ls = local._stamps ?? {};
  let values;
  const stamps = {};

  if (!remote) {
    values = lv;
    for (const k of SYNC_KEYS) stamps[k] = ls[k] || now;
  } else if (firstLink) {
    values = mergeUnion(lv, remote.data ?? {}, { prefs: 'remote' });
    for (const k of SYNC_KEYS) stamps[k] = now;
  } else {
    const rd = remote.data ?? {};
    const rs = remote.stamps ?? {};
    values = {};
    for (const k of SYNC_KEYS) {
      if (rd[k] === undefined) { values[k] = lv[k]; stamps[k] = ls[k] || now; continue; }
      if ((rs[k] || 0) >= (ls[k] || 0)) { values[k] = rd[k]; stamps[k] = rs[k] || 0; } // 같으면 서버 것
      else { values[k] = lv[k]; stamps[k] = ls[k]; }
    }
  }

  const localChanged = SYNC_KEYS.some((k) => !same(values[k], lv[k]));
  const remoteChanged = !remote || !same(values, remote.data ?? {}) || !same(stamps, remote.stamps ?? {});
  return { values, stamps, localChanged, remoteChanged };
}

// 상태가 같은지 비교하는 표식 (서버 문서/내 기기가 이미 같은 내용인지)
export const signature = (data, stamps) => JSON.stringify([data, stamps]);
