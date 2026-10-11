import { TZ } from './grade.js';

const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const pad = (n) => String(n).padStart(2, '0');

// 한국 시간 기준 'YYYY-MM-DD'
export const toYmd = (v) => ymdFmt.format(new Date(v));

const parse = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * 프로그램이 열리는 날짜 목록 ('YYYY-MM-DD'). 오늘 이전 날짜는 뺍니다.
 * 우선순위:
 *   1) 제목에 날짜가 적혀 있으면(tinfo.dates) 그 날들만
 *   2) 제목에 "10월" 같은 달/기간이 있으면 그 구간 안에서만 (tinfo.intervals)
 *   3) 요일을 알면(daySet) 이용 기간 안에서 그 요일인 날마다
 *   4) 요일을 모르는 기간은 기간 안의 모든 날을 "loose"(기간 중 운영, 요일은 상세 확인)로 표시
 * estimated: 제목·설명에 요일이 적혀 있지 않은데 시작·종료 요일이 같아서 반복을 추정한 경우,
 *            또는 "격주"라서 실제로는 격주로 열리는 경우
 */
export function occurrenceDates(course, daySet, todayYmd = toYmd(new Date()), tinfo = null) {
  const exDates = new Set(tinfo?.excludeDates ?? []); // 휴강·휴관 날짜
  const exMonths = new Set(tinfo?.excludeMonths ?? []); // "8월 제외"
  const weeks = daySet && tinfo?.weekOfMonth?.length ? new Set(tinfo.weekOfMonth) : null; // "2,3째주"
  const keep = (ymd) =>
    !exDates.has(ymd) && !exMonths.has(+ymd.slice(5, 7)) && (!weeks || weeks.has(Math.ceil(+ymd.slice(8, 10) / 7)));
  if (tinfo?.dates?.length) {
    return { dates: tinfo.dates.filter((d) => d >= todayYmd && !exDates.has(d)), estimated: false, loose: false };
  }
  if (!course.classStart) return { dates: [], estimated: false, loose: false };
  const s = toYmd(course.classStart);
  const e = course.classEnd ? toYmd(course.classEnd) : s;
  if (e < todayYmd) return { dates: [], estimated: false, loose: false };
  if (e <= s) return { dates: [s], estimated: false, loose: false };
  const biweekly = /격주/.test(course.recurrence || '');
  const explicit = !!(tinfo?.weekdays || (course.weekdays && course.weekdays.length) || course.recurrence);
  const estimated = biweekly || (!!daySet && !explicit);
  const intervals = tinfo?.intervals?.length ? tinfo.intervals : [[s, e]];
  const horizon = fmt(parse(todayYmd) + 150 * 86400000); // 너무 먼 미래는 그리지 않음
  const dates = [];
  for (const [a, b] of intervals) {
    const from = a < todayYmd ? todayYmd : a;
    const to = b < horizon ? b : horizon;
    let t = parse(from);
    const end = parse(to);
    for (let i = 0; t <= end && i < 400; i++, t += 86400000) {
      if ((!daySet || daySet.has(new Date(t).getUTCDay())) && keep(fmt(t))) dates.push(fmt(t));
    }
  }
  return { dates, estimated, loose: !daySet };
}

// 일요일 시작 달력 칸. 빈 칸은 null, 날짜는 'YYYY-MM-DD'. m 은 1~12.
export function monthGrid(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=일
  const offset = first; // 일요일이 첫 칸
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const monthKey = (y, m) => `${y}-${pad(m)}`;
export const dowOfYmd = (ymd) => new Date(parse(ymd)).getUTCDay();
