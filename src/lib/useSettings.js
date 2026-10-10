import { useEffect, useState } from 'react';
import { DEFAULT_KIDS, NEAR_AREAS } from '../data/config';

const KEY = 'seoulkids:settings:v1';
const DEFAULTS = {
  kids: DEFAULT_KIDS,
  activeKids: [], // 비어 있으면 아이 전체
  areas: NEAR_AREAS, // "강남·주변" 으로 볼 자치구
  days: [], // 선택한 요일(0=일 … 6=토), 비어 있으면 전체
  favs: [], // 찜한 프로그램 id
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
