// 자치구 정렬: 우리 집이 있는 구가 맨 앞, 나머지는 구 중심까지의 직선거리 순
import { AREA_CENTERS, HOME } from '../data/config';
import { distanceKm } from './geo';

export const areaDist = (a) =>
  a && a === HOME.area ? -1 : a && AREA_CENTERS[a] ? distanceKm(HOME, AREA_CENTERS[a]) : Infinity;

export const compareAreas = (a, b) => {
  const da = areaDist(a);
  const db = areaDist(b);
  if (da === db) return String(a).localeCompare(String(b));
  return da < db ? -1 : 1;
};
