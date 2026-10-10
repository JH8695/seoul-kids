import { useEffect, useState } from 'react';
import { DEFAULT_KIDS, NEAR_AREAS } from '../data/config';

const KEY = 'seoulkids:settings:v1';
const DEFAULTS = {
  kids: DEFAULT_KIDS,
  activeKids: [], // 비어 있으면 아이 전체
  areas: NEAR_AREAS, // "강남·주변" 으로 볼 자치구
  days: [], // 선택한 요일(0=일 … 6=토), 비어 있으면 전체
  favs: [], // 찜한 프로그램(같은 프로그램 묶음 열쇠 또는 id)
  hidden: [], // "관심 없어요"로 숨긴 프로그램(묶음 열쇠)
  hiddenRounds: [], // "이 회차만 남기기"로 숨긴 회차(예약 id)
  notes: {}, // 회차(예약 id)별 메모와 내 날짜: { id: { text, dates: ['YYYY-MM-DD'] } }
};

// 아이 출생연도 같은 개인 설정은 이 브라우저(localStorage)에만 저장됩니다.
export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return DEFAULTS;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경 */ }
  }, [settings]);
  return [settings, setSettings];
}
