// 못 가는 날: 달력에서 날짜를 눌러 표시해요. offDays = ['YYYY-MM-DD', ...] (오름차순, 중복 없음)
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const valid = (s) => {
  if (typeof s !== 'string' || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // 2026-02-30 같은 날짜는 거름
};

/** 저장된 값 검증 (동기화·가져오기 때 이상한 값이 들어와도 앱이 깨지지 않게). 최대 400개 */
export function cleanOffDays(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(valid))].sort().slice(0, 400);
}

/** 한 날짜를 표시/해제 */
export function toggleOffDay(list, ymd) {
  if (!valid(ymd)) return cleanOffDays(list);
  const cur = cleanOffDays(list);
  return cur.includes(ymd) ? cur.filter((d) => d !== ymd) : cleanOffDays([...cur, ymd]);
}
