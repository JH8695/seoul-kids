// "처음 본 시각" 기록: 새로 올라온 프로그램에 NEW 를 붙이려고 이 기기에만 저장해요(서버·동기화 없음).
//   state: { init: 처음 기록한 시각, ids: { 예약id: 처음 본 시각(ms) } }
// 앱을 처음 열었을 때 이미 있던 프로그램은 "옛것"(0)으로 기록해서 전부 NEW 로 뜨지 않게 해요.
export const NEW_DAYS = 3;
const KEEP_DAYS = 45;

export function updateSeen(prev, ids, now = Date.now()) {
  const list = [...new Set(ids)];
  if (!prev || typeof prev !== 'object' || !prev.ids) {
    return { init: now, ids: Object.fromEntries(list.map((id) => [id, 0])) };
  }
  const next = { ...prev.ids };
  let changed = false;
  for (const id of list) if (!(id in next)) { next[id] = now; changed = true; }
  // 오래 안 보이는 것은 정리 (목록에서 사라진 지 KEEP_DAYS 일이 지난 기록)
  if (list.length > 0) {
    const live = new Set(list);
    const cutoff = now - KEEP_DAYS * 86400000;
    for (const id of Object.keys(next)) {
      if (!live.has(id) && next[id] !== 0 && next[id] < cutoff) { delete next[id]; changed = true; }
    }
  }
  return changed ? { init: prev.init ?? now, ids: next } : prev;
}

export const isNewId = (state, id, now = Date.now()) => {
  const t = state?.ids?.[id];
  return !!t && now - t <= NEW_DAYS * 86400000;
};
