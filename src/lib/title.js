// 프로그램 "제목"에서 읽어 낼 수 있는 정보들.
//   - 날짜    "(12/7)", "12월 7일", "(10/20 성동구)"            → 그 날짜에만 열림
//   - 월      "[10월]", "10월 산림치유"                          → 그 달에만 열림
//   - 요일    "(토)", "(휴일, 토)", "(목, 금요일)", "(월~금)", "주말" → 그 요일에만 열림
//   - 학년    "[주말/토 오후/초등 1~3학년]"                       → 대상 판정 보조
//   - 온라인  "[12월 온라인]"                                    → 거리 숨김
//   - 묶기    날짜·요일·월을 뗀 제목이 같으면 "같은 프로그램의 여러 회차"
// 서울시 목록에는 회차별 날짜가 없고 이용 "기간"만 있어서, 제목의 표기가 가장 믿을 만한 단서예요.

const DAYCH = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dowOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const ymdOfIso = (iso) => (iso ? iso.slice(0, 10) : null); // 수집기가 한국 날짜로 만든 문자열이라 그대로 자름

// 이용 기간 안에 들어오는 연도로 월/일을 완성함 (기간 밖이면 null → 다른 뜻의 숫자로 보고 무시)
function resolveDate(m, d, startYmd, endYmd, nowYear) {
  if (m < 1 || m > 12 || d < 1) return null;
  const years = new Set();
  if (startYmd) years.add(+startYmd.slice(0, 4));
  if (endYmd) years.add(+endYmd.slice(0, 4));
  if (!years.size) years.add(nowYear);
  for (const y of [...years].sort()) {
    if (d > daysIn(y, m)) continue;
    const ymd = `${y}-${pad(m)}-${pad(d)}`;
    if ((!startYmd || ymd >= startYmd) && (!endYmd || ymd <= endYmd)) return ymd;
  }
  return null;
}

const MD = String.raw`(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*일?`; // 12/7, 12월 7일
const RANGE = new RegExp(String.raw`(?<![\d/])${MD}\s*(?:\([^)]*\))?\s*[~～\-]\s*${MD}`, 'g');
// 제목 끝의 날짜 코드 "(261023)" = 2026년 10월 23일 (괄호 안의 여섯 자리: 연·월·일 두 자리씩)
const YYMMDD = /[(\[]\s*(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\s*[)\]]/g;
const SINGLE_SLASH = /(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g;
const SINGLE_KOR = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
const MONTH_RANGE = /(?<![가-힣\d])(\d{1,2})\s*월\s*[~～\-]\s*(\d{1,2})\s*월/g;
const MONTH = /(?<![가-힣\d])(\d{1,2})\s*월(?!\s*\d)/g;

const lastDay = (ymd) => `${ymd.slice(0, 8)}${pad(daysIn(+ymd.slice(0, 4), +ymd.slice(5, 7)))}`;

// 월 하나 → 이용 기간과 겹치는 구간들
function monthIntervals(m, startYmd, endYmd, nowYear) {
  const years = new Set();
  if (startYmd) years.add(+startYmd.slice(0, 4));
  if (endYmd) years.add(+endYmd.slice(0, 4));
  if (!years.size) years.add(nowYear);
  const out = [];
  for (const y of [...years].sort()) {
    let a = `${y}-${pad(m)}-01`;
    let b = lastDay(a);
    if (startYmd && a < startYmd) a = startYmd;
    if (endYmd && b > endYmd) b = endYmd;
    if (a <= b) out.push([a, b]);
  }
  return out;
}

const DAY_TOKEN = new RegExp(`^([${DAYCH}])(?:요일)?$`);
const DAY_RANGE = new RegExp(`^([${DAYCH}])(?:요일)?[~～\\-]([${DAYCH}])(?:요일)?$`);

function expandRange(a, b) {
  const out = [];
  let i = DAYCH.indexOf(a);
  const j = DAYCH.indexOf(b);
  for (let n = 0; n < 7; n++) { out.push(i); if (i === j) break; i = (i + 1) % 7; }
  return out;
}

// 괄호·대괄호 안의 낱말들에서 요일을 모음
function weekdaysFromTitle(title) {
  const days = new Set();
  let weekend = false;
  let weekday = false;
  let holiday = false;
  const readToken = (tok) => {
    let m;
    if ((m = tok.match(DAY_TOKEN))) days.add(DAYCH.indexOf(m[1]));
    else if ((m = tok.match(DAY_RANGE))) expandRange(m[1], m[2]).forEach((d) => days.add(d));
    else if (/^주말$/.test(tok)) weekend = true;
    else if (/^평일$/.test(tok)) weekday = true;
    else if (/^(?:휴일|공휴일)$/.test(tok)) holiday = true;
  };
  for (const m of title.matchAll(/[(\[（]([^)\]）]*)[)\]）]/g)) {
    m[1].split(/[\s,，/·&]+|및/).filter(Boolean).forEach(readToken);
  }
  // 괄호 밖: "매주 토", "격주 토요일", "토요일"
  for (const m of title.matchAll(new RegExp(`(?:매주|격주)\\s*([${DAYCH}](?:\\s*[,·/]\\s*[${DAYCH}])*)`, 'g'))) {
    m[1].split(/[\s,·/]+/).filter(Boolean).forEach((c) => days.add(DAYCH.indexOf(c)));
  }
  for (const m of title.matchAll(new RegExp(`(?<![가-힣\\d])([${DAYCH}])요일`, 'g'))) days.add(DAYCH.indexOf(m[1]));
  if (/(?<![가-힣])주말(?![가-힣])/.test(title)) weekend = true;
  if (/(?<![가-힣])평일(?![가-힣])/.test(title)) weekday = true;

  if (days.size) return [...days].sort((a, b) => a - b); // 요일이 적혀 있으면 "주말"·"휴일"보다 우선 (예: "휴일, 토" → 토)
  if (weekend) return [0, 6];
  if (weekday) return [1, 2, 3, 4, 5];
  if (holiday) return [0]; // 공휴일 날짜는 알 수 없어 일요일로만 취급
  return null;
}

/**
 * 제목에서 읽은 일정 단서.
 * @returns { dates: string[]|null, intervals: [string,string][]|null, weekdays: number[]|null }
 *   dates     날짜가 직접 적힌 경우 그 날들만 (이용 기간 안의 날짜만 인정)
 *   intervals "10월"처럼 달/기간이 적힌 경우 그 구간들
 *   weekdays  요일이 적힌 경우
 */
export function titleInfo(course, nowYear = new Date().getFullYear()) {
  const title = course.title ?? '';
  const startYmd = ymdOfIso(course.classStart);
  const endYmd = ymdOfIso(course.classEnd);
  let rest = title;
  const dates = new Set();
  const intervals = [];

  // 0) 날짜 코드 "(261023)" — 이용 기간 안에 들어오는 날짜일 때만 인정
  rest = rest.replace(YYMMDD, (m, yy, mm, dd) => {
    const y = 2000 + +yy;
    if (+dd > daysIn(y, +mm)) return m;
    const ymd = `${y}-${mm}-${dd}`;
    if ((startYmd && ymd < startYmd) || (endYmd && ymd > endYmd)) return m;
    dates.add(ymd);
    return ' ';
  });
  // 1) 날짜 범위 "10/15~11/2"
  rest = rest.replace(RANGE, (m, m1, d1, m2, d2) => {
    const a = resolveDate(+m1, +d1, startYmd, endYmd, nowYear);
    const b = resolveDate(+m2, +d2, startYmd, endYmd, nowYear);
    if (a && b && a <= b) intervals.push([a, b]);
    return ' ';
  });
  // 2) 날짜 하나 "12/7", "12월 7일"
  const single = (m, mm, dd) => {
    const d = resolveDate(+mm, +dd, startYmd, endYmd, nowYear);
    if (d) dates.add(d);
    return ' ';
  };
  rest = rest.replace(SINGLE_KOR, single).replace(SINGLE_SLASH, single);
  // 3) 월 범위 "9월~11월", 월 하나 "10월"
  const monthIvs = [];
  rest = rest.replace(MONTH_RANGE, (m, a, b) => {
    for (let k = +a, n = 0; n < 12; n++, k = (k % 12) + 1) { monthIvs.push(...monthIntervals(k, startYmd, endYmd, nowYear)); if (k === +b) break; }
    return ' ';
  });
  rest = rest.replace(MONTH, (m, a) => { monthIvs.push(...monthIntervals(+a, startYmd, endYmd, nowYear)); return ' '; });
  intervals.push(...monthIvs);

  return {
    dates: dates.size ? [...dates].sort() : null,
    intervals: !dates.size && intervals.length ? intervals.sort((x, y) => (x[0] < y[0] ? -1 : 1)) : null,
    weekdays: weekdaysFromTitle(title),
  };
}

/** 제목에 적힌 학년·나이 조건만 뽑아 낸 짧은 글 (예: "초등 1~3학년"). 없으면 null */
export function extractTitleTarget(title) {
  const parts = [];
  const patterns = [
    /(?:초등학교|초등|초)\s*\d{1,2}\s*(?:학년)?\s*(?:[~\-]\s*(?:(?:초등학교|초등|초)\s*)?\d{1,2}\s*(?:학년)?)?/g,
    /(?<![\d/])\d{1,2}\s*[~\-]\s*\d{1,2}\s*학년/g,
    /(?<![\d/])\d{1,2}\s*학년/g,
    /(?:만\s*)?\d{1,2}\s*(?:[~\-]\s*\d{1,2})?\s*세(?:\s*이상|\s*이하)?/g,
    /\d{1,3}\s*(?:[~\-]\s*\d{1,3})?\s*개월\s*(?:이상|이하|미만|이내)?/g,
    /저학년|중학년|고학년/g,
  ];
  let rest = title ?? '';
  for (const re of patterns) {
    rest = rest.replace(re, (m) => { parts.push(m.trim()); return ' '; });
  }
  return parts.length ? parts.join(' ') : null;
}

export function isOnline(course) {
  return /온라인|비대면|화상|ZOOM/i.test(`${course.title ?? ''} ${course.place ?? ''}`);
}

// ---- 묶기 ------------------------------------------------------------------

const DAYISH_REMOVE = new RegExp(
  `매주|격주|주말|평일|공휴일|휴일|요일|오전|오후|\\d{1,2}:\\d{2}|\\d{1,2}시(?:\\s*\\d{1,2}분)?|[${DAYCH}]|[\\s,，/·&~～.\\-]|및`,
  'g',
);

/** 날짜·월·요일을 뗀 제목 (같은 프로그램의 회차끼리 같아지도록) */
export function stripTitle(title) {
  let t = String(title ?? '');
  t = t.replace(YYMMDD, ' ').replace(RANGE, ' ').replace(SINGLE_KOR, ' ').replace(SINGLE_SLASH, ' ');
  t = t.replace(MONTH_RANGE, ' ').replace(MONTH, ' ');
  // 요일 표기뿐인 괄호는 통째로 뗌: "(휴일, 토)", "(토)", "[주말/토 오후]"
  t = t.replace(/[(\[（]([^)\]）]*)[)\]）]/g, (m, inner) => (inner.replace(DAYISH_REMOVE, '') === '' ? ' ' : m));
  t = t.replace(/(?:매주|격주)\s*[일월화수목금토](?:\s*[,·/]\s*[일월화수목금토])*(?:\s*요일)?/g, ' ');
  return t.replace(/\(\s*\)|\[\s*\]/g, ' ').replace(/[\s\-–,]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const compact = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** 같은 프로그램으로 볼 열쇠: 뗀 제목 + 장소 + 대상 */
export function groupKeyOf(course) {
  return `${stripTitle(course.title)}|${compact(course.place)}|${compact(course.targetText)}`;
}

const mdw = (ymd) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}(${DAYCH[dowOf(ymd)]})`;

/** 묶음 안에서 회차를 구분하는 짧은 이름 (칩에 표시) */
export function chipLabel(course, info) {
  if (info?.dates?.length) {
    return info.dates.length === 1 ? mdw(info.dates[0]) : `${mdw(info.dates[0])} 외 ${info.dates.length - 1}`;
  }
  const md = (ymd) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}`;
  const days = info?.weekdays ? info.weekdays.map((d) => DAYCH[d]).join('·') : '';
  let when;
  if (info?.intervals?.length === 1) {
    const [a, b] = info.intervals[0];
    // 달 전체면 "10월", 아니면 "10/5~10/31"
    when = a.endsWith('-01') && b === lastDay(a) ? `${+a.slice(5, 7)}월` : `${md(a)}~${md(b)}`;
  } else {
    const s = ymdOfIso(course.classStart);
    const e = ymdOfIso(course.classEnd);
    when = s && e && s !== e ? `${md(s)}~${md(e)}` : s ? mdw(s) : '';
  }
  return `${when}${days ? ` ${days}` : ''}`.trim() || '회차';
}

// ---- 상시 운영 -------------------------------------------------------------
// "10월 운영 안내", "전시해설 예약"처럼 날짜가 정해진 행사가 아니라 한 달 내내 열려 있는 시설 예약.
// 달력의 모든 날에 찍혀 숫자를 부풀리므로, 달력·목록에서 따로 모아 접어 둡니다.

// 수시·상시·상설·연중·매일은 뒤에 모집/신청/운영/예약 무엇이 붙어도 상시로 봄
const STANDING_WORDS = /수시|상시|상설|연중|매일|운영\s*안내|운영\s*일정|전시\s*해설\s*예약|관람\s*예약/;
const hm = (iso) => (iso && iso.length >= 16 ? +iso.slice(11, 13) * 60 + +iso.slice(14, 16) : null);
const dayNum = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86400000);

export function isStanding(course, info) {
  if (info?.dates?.length) return false; // 날짜가 적혀 있으면 정해진 회차
  if (STANDING_WORDS.test(course.title ?? '')) return true;
  const s = ymdOfIso(course.classStart);
  const e = ymdOfIso(course.classEnd);
  const longWindow = !!(s && e && dayNum(e) - dayNum(s) >= 21);
  // 평일 매일(월~금)이나 매일 반복되는 장기 프로그램은 달력에서 모든 평일에 찍히므로 상시로 봄
  const days = info?.weekdays ?? (course.weekdays && course.weekdays.length ? course.weekdays : null);
  if (days) return days.length >= 5 && longWindow;
  // 요일 정보 없이 한 달 가까이, 하루 6시간 이상 열려 있으면 상시 운영으로 봄
  if (!s || !e || !course.timeKnown) return false;
  const a = hm(course.classStart);
  const b = hm(course.classEnd);
  if (a == null || b == null) return false;
  return dayNum(e) - dayNum(s) >= 20 && b - a >= 360;
}
