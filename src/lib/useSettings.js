import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_KIDS, NEAR_AREAS } from '../data/config';
import { bumpStamps } from './sync';

const KEY = 'seoulkids:settings:v1';
const DEFAULTS = {
  kids: DEFAULT_KIDS,
  activeKids: [], // 비어 있으면 아이 전체
  areas: NEAR_AREAS, // "선택한 구"로 볼 자치구
  days: [], // 선택한 요일(0=일 … 6=토), 비어 있으면 전체
  favs: [], // 찜한 프로그램(같은 프로그램 묶음 열쇠 또는 id)
  hidden: [], // "관심 없어요"로 숨긴 프로그램(묶음 열쇠)
  hiddenRounds: [], // "이 회차만 남기기"로 숨긴 회차(예약 id)
  notes: {}, // 회차(예약 id)별 메모와 내 날짜: { id: { text, dates: ['YYYY-MM-DD'] } }
  _stamps: {}, // 항목별 마지막으로 고친 시각 (기기 간 동기화용)
  _linked: null, // 이 기기가 연결한 구글 계정(uid)
};

// 개인 설정은 이 기기(localStorage)에 저장하고, 구글 로그인을 하면 계정에도 동기화돼요.
// setSettings 는 값이 바뀐 항목의 "고친 시각"을 같이 기록해요(동기화 때 나중에 고친 쪽을 따르기 위해).
// applyRemote 는 서버에서 받은 값을 적용해요(시각은 그대로 둠).
export function useSettings() {
  const [settings, setState] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return DEFAULTS;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경 */ }
  }, [settings]);

  const setSettings = useCallback(
    (update) =>
      setState((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        return bumpStamps(prev, next, Date.now());
      }),
    [],
  );
  const applyRemote = useCallback(
    (values, stamps, uid) => setState((prev) => ({ ...prev, ...values, _stamps: stamps, _linked: uid ?? prev._linked })),
    [],
  );
  return [settings, setSettings, applyRemote];
}
