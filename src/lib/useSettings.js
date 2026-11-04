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
  hideWords: [], // 숨길 단어: 센터 이름·프로그램 제목에 들어 있으면 숨김
  placesScope: null, // 센터 목록의 구 범위: null(메인 화면을 따라감) | 'all' | 'mine'(내가 선택한 구) | 구 이름
  offDays: [], // 못 가는 날(달력에서 표시): ['YYYY-MM-DD']
  travel: { transit: null, car: null }, // 이동시간 필터: 대중교통 30|60분, 자차 20|40분 이내 (센터별 시간은 places 의 tr·cr)
  scope: 'near', // 마지막으로 고른 보기 범위: near(선택한 구) | all(서울 전체)
  bothKids: false, // 아이를 둘 이상 골랐을 때, 모두 갈 수 있는 프로그램만
  places: {}, // 관심(★)·제외(✕) 장소: { 열쇠: { s: 'fav'|'hide', n: 이름 } }
  searches: { recent: [], pinned: [] }, // 최근·고정 검색어
  busy: [], // 갈 수 없는 시간: [{ id, days:[6], start:'10:00', end:'11:50' }]
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
