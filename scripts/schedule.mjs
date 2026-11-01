// 상세 설명 글에서 "언제 열리는지"를 읽어요. 서울시 공개 데이터의 이용 기간은 사이트의 실제 이용기간과
// 다른 경우가 많아서(예: 9/25~10/24 로 나오지만 실제는 10/17, 10/24), 설명에 적힌 운영일이 더 정확해요.
//
// 지금까지 확인된 표기:
//   운영일 : 17일,24일(토)/14시~15시30분          (월은 제목의 "/10월" 에서)
//   운영일정 : 10월 토, 일                       (월 + 요일)
//   10월 6, 13, 27일 (화요일)                    (월 + 날짜들)
//   | 1 | 10월 17일(토) 14:00~15:20 | …            (표의 회차 줄)
//   운영시간: 매일 화~토                          (요일 범위 → 상시 운영 판정에 쓰임)
//   교육기간 ~ / 매주 토요일 ... ※ 휴강 안내 : 9월 26일, 10월 3일, 10일   (쉬는 날은 운영일이 아님)
//   요일 및 시간 토요일 2,3주 오전 10시~12시 / 8월 제외                      (몇째 주, 제외 달)
//   휴관일 : 매주 월요일                          (쉬는 요일)
// 접수·신청·마감 같은 말 근처의 날짜(접수 기간 안내 등)는 운영일로 보지 않아요.
import { titleInfo, parseNthWeeks } from '../src/lib/title.js';

const DAYCH = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dowOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

const SKIP_CONTEXT = /접수|신청|마감|모집|발표|취소|입금|결제|환불|추첨|선정|오픈|문의/;
const KEYWORD = /운영\s*일정?|운영일|운영\s*일시|수업\s*일시|수업일|진행일|교육일|교육\s*일시|일\s*시|일정|날짜|회차|강의일/;
const LABEL = '(?:\\(\\s*([일월화수목금토])\\s*(?:요일)?\\s*\\)|([일월화수목금토])요일)';
const SEP = '(?:\\s*[,·、/]\\s*|\\s*(?:및|와|과)\\s*|\\s+)';
const CLOSURE = '휴강|휴관|휴무|휴원|결강|쉬는\\s*날';
const CLOSURE_BEFORE = new RegExp(`(?:${CLOSURE})\\s*(?:일|안내|일정)?\\s*[:：]?\\s*(?:매월|매달)?\\s*$`);

// "8월 18일 ~ 9월 28일" 같은 기간 표현의 양 끝은 운영일이 아님
function isRangePart(d, start, end) {
  const prev = d.slice(Math.max(0, start - 14), start).replace(/(?:20\d{2}\s*년\s*)?$/, '').trimEnd();
  const next = d.slice(end, end + 8);
  return /(?:~|∼|부터)$/.test(prev) || /^\s*(?:부터|~|∼)/.test(next);
}

const ymdOf = (iso) => (iso ? iso.slice(0, 10) : null);
const inWin = (ymd, s, e) => (!s || ymd >= s) && (!e || ymd <= e);
const snip = (d, idx, len) => d.slice(Math.max(0, idx - 10), idx + len + 12).replace(/\s+/g, ' ').trim().slice(0, 80);

function monthsOfWindow(s, e) {
  if (!s || !e) return [];
  const out = [];
  let y = +s.slice(0, 4);
  let m = +s.slice(5, 7);
  for (let i = 0; i < 4; i++) {
    out.push([y, m]);
    if (y === +e.slice(0, 4) && m === +e.slice(5, 7)) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

// 한 묶음("6, 13, 27일 (화요일)")에서 날짜 항목과 요일 표시를 뽑음
function readItems(group) {
  const items = [];
  let shared = null; // 묶음 끝에 한 번만 적힌 요일 표시는 전체에 적용
  const re = new RegExp(String.raw`(\d{1,2})\s*일?\s*${LABEL}?`, 'g');
  let m;
  while ((m = re.exec(group))) {
    const label = m[2] ?? m[3] ?? null;
    items.push({ day: +m[1], label });
  }
  const labels = items.filter((i) => i.label).map((i) => i.label);
  if (labels.length === 1 && items.length > 1 && items[items.length - 1].label) shared = labels[0];
  return items.map((i) => ({ ...i, label: i.label ?? shared }));
}

function pushDate(set, y, m, day, label, s, e) {
  if (m < 1 || m > 12 || day < 1 || day > daysIn(y, m)) return;
  const ymd = `${y}-${pad(m)}-${pad(day)}`;
  if (!inWin(ymd, s, e)) return;
  if (label && DAYCH[dowOf(ymd)] !== label) return; // 적힌 요일과 실제 요일이 다르면 못 믿음
  set.add(ymd);
}

/** "※ 휴강 안내 : 9월 26일, 10월 3일, 10일" / "휴관일 : 매주 월요일" → 쉬는 날짜·요일 */
function parseClosures(d, s, e, years) {
  const dates = new Set();
  const weekdays = new Set();
  const spans = [];
  const sources = [];
  const re = new RegExp(`(${CLOSURE})(?:\\s*일|\\s*안내|\\s*일정|\\s*예정)?\\s*[:：]?\\s*([^▶※■○ㅇ]{0,70})`, 'g');
  let m;
  while ((m = re.exec(d))) {
    const seg = m[2];
    const end = m.index + m[0].length;
    spans.push([m.index, end]);
    const winMonths = monthsOfWindow(s, e);
    let ctx = winMonths.length === 1 ? winMonths[0][1] : null;
    let found = false;
    for (const t of seg.matchAll(/(\d{1,2})\s*월|(\d{1,2})\s*일|(?:매주\s*)?([일월화수목금토])요일/g)) {
      if (t[1]) ctx = +t[1];
      else if (t[2] && ctx) {
        for (const y of years.length ? years : [new Date().getFullYear()]) pushDate(dates, y, ctx, +t[2], null, s, e);
        found = true;
      } else if (t[3]) { weekdays.add(DAYCH.indexOf(t[3])); found = true; }
    }
    if (found) sources.push(snip(d, m.index, m[0].length));
  }
  return { dates, weekdays, spans, sources };
}

/** "8월 제외", "8월은 제외", "8월 휴강" → 제외하는 달 */
function parseExcludeMonths(d) {
  const out = new Set();
  for (const m of d.matchAll(/(\d{1,2})\s*월\s*(?:은|는)?\s*(?:모두\s*)?(?:제외|휴강|휴관|휴무)/g)) {
    if (+m[1] >= 1 && +m[1] <= 12) out.add(+m[1]);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * @returns {{
 *   dates: string[]|null,        설명에 적힌 운영 날짜
 *   weekdays: number[]|null,     운영 요일
 *   weekOfMonth: number[]|null,  몇째 주 (예: [2,3])
 *   closedDates: string[]|null,  휴강·휴관 날짜
 *   closedWeekdays: number[]|null 휴관 요일 (예: 매주 월요일 휴관 → [1])
 *   excludeMonths: number[]|null,운영하지 않는 달
 *   sources: string[]            읽은 근거 문장
 * }}
 */
export function parseDetailSchedule(detail, { title = '', classStart = null, classEnd = null } = {}) {
  const d = String(detail ?? '').replace(/(\d)\s+일/g, '$1일').replace(/(\d)\s+월/g, '$1월');
  const s = ymdOf(classStart);
  const e = ymdOf(classEnd);
  const dates = new Set();
  const sources = [];
  const years = [...new Set([s && +s.slice(0, 4), e && +e.slice(0, 4)].filter(Boolean))];
  const yrs = years.length ? years : [new Date().getFullYear()];

  // 0) 쉬는 날(휴강·휴관): 운영일로 읽지 않고 따로 모음
  const closures = parseClosures(d, s, e, years);
  const inClosure = (idx) => closures.spans.some(([a, b]) => idx >= a && idx < b);

  // 1) "10월 6, 13, 27일 (화요일)" / "10월 17일(토) 14:00~15:20"
  const listRe = new RegExp(
    String.raw`(\d{1,2})\s*월\s*((?:\d{1,2}\s*,\s*)*\d{1,2}\s*일\s*${LABEL}?(?:${SEP}\d{1,2}\s*일\s*${LABEL}?)*)`,
    'g',
  );
  let m;
  while ((m = listRe.exec(d))) {
    const before = d.slice(Math.max(0, m.index - 20), m.index);
    if (SKIP_CONTEXT.test(before) || CLOSURE_BEFORE.test(before) || inClosure(m.index) || isRangePart(d, m.index, m.index + m[0].length)) continue;
    const after = d.slice(m.index + m[0].length, m.index + m[0].length + 25);
    const items = readItems(m[2]);
    const hasLabel = items.some((i) => i.label);
    const hasTime = /\d{1,2}\s*[:시]\s*\d{0,2}/.test(after);
    const hasKeyword = KEYWORD.test(d.slice(Math.max(0, m.index - 30), m.index));
    if (!(hasLabel || hasTime || hasKeyword)) continue;
    const n0 = dates.size;
    for (const it of items) for (const y of yrs) pushDate(dates, y, +m[1], it.day, it.label, s, e);
    if (dates.size > n0 && sources.length < 3) sources.push(snip(d, m.index, m[0].length));
  }

  // 1-2) 며칠 안 되는 연속 기간 — "2026.11.7(토)~11.8(일)", "11월 7일(토)~8일(일)":
  //       양 끝이 운영일이고 사이 날들도 모두 운영하는 것으로 봄. 7일을 넘는 긴 기간(이용기간)과 접수기간은 제외
  const shortRanges = [
    new RegExp(String.raw`(?:(20\d{2})\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})\s*${LABEL}?\s*(?:~|∼|～|–)\s*(?:(?:(20\d{2})\s*\.\s*)?(\d{1,2})\s*\.\s*)?(\d{1,2})\s*${LABEL}?`, 'g'),
    new RegExp(String.raw`(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*${LABEL}?\s*(?:~|∼|～|–)\s*(?:(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*)?(\d{1,2})\s*일\s*${LABEL}?`, 'g'),
  ];
  for (const re of shortRanges) {
    while ((m = re.exec(d))) {
      // 그룹: 앞쪽 끝 = 연·월·일·요일(2개 자리), 뒤쪽 끝 = 연·월·일·요일(2개 자리). 뒤쪽 끝은 월이 생략될 수 있음
      const g = m.slice(1);
      const [y1, m1, d1, la1, lb1, y2, m2, d2, la2, lb2] = g;
      const before = d.slice(Math.max(0, m.index - 20), m.index);
      if (SKIP_CONTEXT.test(before) || CLOSURE_BEFORE.test(before) || inClosure(m.index)) continue;
      const l1 = la1 ?? lb1 ?? null;
      const l2 = la2 ?? lb2 ?? null;
      if (!(l1 || l2 || KEYWORD.test(d.slice(Math.max(0, m.index - 30), m.index)))) continue;
      const n0 = dates.size;
      for (const Y of y1 ? [+y1] : yrs) {
        const mo1 = +m1;
        const mo2 = m2 ? +m2 : mo1;
        const Y2 = y2 ? +y2 : mo2 < mo1 ? Y + 1 : Y;
        if (mo1 < 1 || mo1 > 12 || mo2 < 1 || mo2 > 12 || +d1 < 1 || +d1 > daysIn(Y, mo1) || +d2 < 1 || +d2 > daysIn(Y2, mo2)) continue;
        const a = `${Y}-${pad(mo1)}-${pad(+d1)}`;
        const b = `${Y2}-${pad(mo2)}-${pad(+d2)}`;
        const span = Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
        if (span < 2 || span > 7) continue;
        if ((l1 && DAYCH[dowOf(a)] !== l1) || (l2 && DAYCH[dowOf(b)] !== l2)) continue; // 적힌 요일이 실제와 다르면 못 믿음
        for (let i = 0; i < span; i++) {
          const day = new Date(Date.parse(`${a}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
          if (inWin(day, s, e)) dates.add(day);
        }
      }
      if (dates.size > n0 && sources.length < 3) sources.push(snip(d, m.index, m[0].length));
    }
  }

  // 2) 월이 없는 "운영일 : 17일,24일(토)" — 월은 제목의 "/10월" 이나 이용 기간에서
  const keyRe = new RegExp(
    String.raw`(?:운영\s*일정?|운영일|일\s*시|일정|수업일|진행일|교육일|날짜)\s*[:：]?\s*((?:\d{1,2}\s*일\s*${LABEL}?${SEP}?)+)`,
    'g',
  );
  const tinfo = titleInfo({ title, classStart, classEnd });
  const monthCands = tinfo.intervals?.length
    ? [...new Set(tinfo.intervals.map(([a]) => `${a.slice(0, 4)}-${a.slice(5, 7)}`))].map((k) => [+k.slice(0, 4), +k.slice(5, 7)])
    : monthsOfWindow(s, e);
  while ((m = keyRe.exec(d))) {
    if (inClosure(m.index) || CLOSURE_BEFORE.test(d.slice(Math.max(0, m.index - 12), m.index))) continue;
    const items = readItems(m[1]);
    const n0 = dates.size;
    for (const it of items) {
      for (const [y, mo] of monthCands) {
        const before = dates.size;
        pushDate(dates, y, mo, it.day, it.label, s, e);
        if (dates.size > before) break; // 처음 맞는 달 하나만
      }
    }
    if (dates.size > n0 && sources.length < 3) sources.push(snip(d, m.index, m[0].length));
  }

  // 3) "10/17(토)" 처럼 요일이 같이 적힌 날짜
  const slashRe = new RegExp(String.raw`(?<![\d/])(\d{1,2})\s*/\s*(\d{1,2})\s*${LABEL}`, 'g');
  while ((m = slashRe.exec(d))) {
    const before = d.slice(Math.max(0, m.index - 20), m.index);
    if (SKIP_CONTEXT.test(before) || CLOSURE_BEFORE.test(before) || inClosure(m.index) || isRangePart(d, m.index, m.index + m[0].length)) continue;
    const n0 = dates.size;
    for (const y of yrs) pushDate(dates, y, +m[1], +m[2], m[3] ?? m[4], s, e);
    if (dates.size > n0 && sources.length < 3) sources.push(snip(d, m.index, m[0].length));
  }
  // 쉬는 날은 운영 날짜에서 뺌
  closures.dates.forEach((x) => dates.delete(x));

  // 4) 요일 · 몇째 주 · 제외 달
  const nth = parseNthWeeks(d);
  const opDays = parseDetailWeekdays(d);
  let weekdays = nth ? nth.weekdays : opDays;
  if (nth) {
    const mm = /(?:[1-5]|첫|둘|셋|넷|다섯)\s*(?:째|번째)?\s*(?:[,·/]\s*(?:[1-5]|첫|둘|셋|넷|다섯)\s*(?:째|번째)?\s*)*주|[일월화수목금토]요일?\s*[1-5][^\n]{0,4}주/.exec(d);
    if (mm && sources.length < 3) sources.push(snip(d, mm.index, mm[0].length));
  } else if (opDays) {
    const w = /(?:운영\s*일정?|운영일|운영\s*요일|수업\s*요일|운영\s*시간|일\s*시)[^\n]{0,30}/.exec(d);
    if (w && sources.length < 3) sources.push(snip(d, w.index, w[0].length));
  }
  // 운영 요일은 없고 쉬는 요일만 있으면 → 그 요일을 뺀 나머지 요일에 운영 (예: "휴관일 : 매주 월요일")
  const closedWeekdays = [...closures.weekdays].sort((a, b) => a - b);
  if (!weekdays && !dates.size && closedWeekdays.length) {
    weekdays = [0, 1, 2, 3, 4, 5, 6].filter((x) => !closures.weekdays.has(x));
    if (closures.sources[0] && sources.length < 3) sources.push(closures.sources[0]);
  }
  const excludeMonths = parseExcludeMonths(d);
  if (excludeMonths.length) {
    const x = new RegExp(`${excludeMonths[0]}\\s*월\\s*(?:은|는)?\\s*(?:모두\\s*)?(?:제외|휴강|휴관|휴무)`).exec(d);
    if (x && sources.length < 3) sources.push(snip(d, x.index, x[0].length));
  }
  if (closures.dates.size && closures.sources[0] && sources.length < 3 && !sources.includes(closures.sources[0])) sources.push(closures.sources[0]);

  return {
    dates: dates.size ? [...dates].sort() : null,
    weekdays: weekdays ?? null,
    weekOfMonth: nth ? nth.weeks : null,
    closedDates: closures.dates.size ? [...closures.dates].sort() : null,
    closedWeekdays: closedWeekdays.length ? closedWeekdays : null,
    excludeMonths: excludeMonths.length ? excludeMonths : null,
    sources,
  };
}

const DAYTOK = '[일월화수목금토](?:요일|(?![가-힣]))';

/** 설명의 "운영일정 : 10월 토, 일", "운영시간: 매일 화~토" 에서 요일을 읽음 (휴관 안내는 제외) */
export function parseDetailWeekdays(detail) {
  const d = String(detail ?? '');
  const closedAfter = (text, end) => /^\s*(?:은|는)?\s*(?:휴관|휴무|휴원|쉽니다|쉬는)/.test(text.slice(end, end + 10));
  const closedBefore = (text, idx) => CLOSURE_BEFORE.test(text.slice(Math.max(0, idx - 12), idx));
  const expand = (a, b) => {
    const out = [];
    let i = DAYCH.indexOf(a);
    const j = DAYCH.indexOf(b);
    for (let n = 0; n < 7; n++) { out.push(i); if (i === j) break; i = (i + 1) % 7; }
    return out;
  };
  const head = String.raw`(?:운영\s*일정?|운영일|운영\s*요일|수업\s*요일|진행\s*요일|운영\s*시간|일\s*시)\s*[:：]?\s*(?:\d{1,2}\s*월\s*)?(?:매일|매주)?\s*`;

  // 범위 "화~토"
  const rangeRe = new RegExp(String.raw`(?:${head}|(?:매일|매주)\s*)([일월화수목금토])(?:요일)?\s*[~\-]\s*([일월화수목금토])(?:요일|(?![가-힣]))`, 'g');
  let m;
  while ((m = rangeRe.exec(d))) {
    if (closedAfter(d, m.index + m[0].length) || closedBefore(d, m.index)) continue;
    return expand(m[1], m[2]);
  }
  // 나열 "토, 일" / "토요일"
  const listRe = new RegExp(String.raw`${head}((?:${DAYTOK})(?:\s*[,·/、]\s*(?:${DAYTOK}))*)`, 'g');
  while ((m = listRe.exec(d))) {
    if (closedAfter(d, m.index + m[0].length) || closedBefore(d, m.index)) continue;
    const days = [...new Set([...m[1]].filter((c) => DAYCH.includes(c)).map((c) => DAYCH.indexOf(c)))].sort((a, b) => a - b);
    if (days.length) return days;
  }
  // "주말" / "평일"
  const wk = new RegExp(String.raw`${head}(주말|평일)`).exec(d);
  if (wk) return wk[1] === '주말' ? [0, 6] : [1, 2, 3, 4, 5];
  return null;
}

// ───────── 시간대 읽기 ─────────
// 서울시 데이터의 V_MIN~V_MAX 는 "가장 이른 시작 ~ 가장 늦은 끝" 한 쌍뿐이라서,
// "10:00~11:30 / 13:00~14:30" 처럼 시간대가 나뉘어 있으면 10:00~14:30 으로 합쳐져 버려요.
// 설명에서 시간대를 따로 읽어 두면 중간의 빈 시간을 살릴 수 있어요.
const hhmm = (h, m) => `${pad(h)}:${pad(m)}`;
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);

// 시각 한 개: "오후 2시 30분", "14시30분", "14:00", "2시", "10시 반"
const TIME = String.raw`(오전|오후)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시\s*(?:(\d{1,2})\s*분?|(반))?)`;
const RANGE = new RegExp(String.raw`${TIME}\s*(?:~|∼|～|–|-|에서)\s*${TIME}`, 'g');

function to24(mer, h, noMerFallback) {
  if (mer === '오후') return h < 12 ? h + 12 : h;
  if (mer === '오전') return h === 12 ? 0 : h;
  return noMerFallback(h);
}

/**
 * 설명에서 시간대를 모두 읽음.
 * @returns {{ slots: {start:string,end:string,days:number[]|null}[], sources: string[] }}
 *   - 접수·신청·문의 같은 말 근처의 시각은 제외
 *   - 각 시간대 바로 앞에 요일(토요일, (토), 주말, 평일)이 적혀 있으면 days 로 남김
 */
export function parseTimeSlots(detail) {
  const d = String(detail ?? '').replace(/\s+/g, ' ');
  const slots = [];
  const sources = [];
  RANGE.lastIndex = 0;
  let m;
  while ((m = RANGE.exec(d))) {
    const [, mer1, h1, mi1, mi1b, half1, mer2, h2, mi2, mi2b, half2] = m;
    // 접수·신청 같은 말이 같은 항목(\"/ | ; ※ ▶\" 로 끊은 앞부분) 안에 있으면 수업 시각이 아님
    const before = d.slice(Math.max(0, m.index - 24), m.index).split(/[\/|;※▶■○ㅇ•]/).pop();
    if (SKIP_CONTEXT.test(before)) continue;
    // 날짜 범위의 \"10-11\" 같은 것을 시각으로 오인하지 않게: 콜론 또는 \"시\"가 하나도 없으면 건너뜀
    if (!/[:시]/.test(m[0])) continue;
    const min1 = mi1 != null ? +mi1 : mi1b != null ? +mi1b : half1 ? 30 : 0;
    const min2 = mi2 != null ? +mi2 : mi2b != null ? +mi2b : half2 ? 30 : 0;
    let H1 = to24(mer1, +h1, (h) => (h >= 1 && h <= 7 ? h + 12 : h)); // 병기 없는 1~7시는 오후로 봄
    let H2 = to24(mer2 ?? mer1, +h2, (h) => h);
    if (!mer2 && !mer1 && H2 <= H1 && H2 < 12) H2 += 12;
    if (!mer2 && mer1 === '오전' && H2 < H1) H2 += 12;
    if (H1 > 23 || H2 > 24 || min1 > 59 || min2 > 59) continue;
    const start = hhmm(H1, min1);
    const end = H2 === 24 ? '23:59' : hhmm(H2, min2);
    if (toMin(end) <= toMin(start)) continue;
    if (toMin(start) < 6 * 60) continue; // 새벽 시간대는 시각이 아닌 것으로 봄

    // 바로 앞의 요일 표시 (\"10월\"의 월, \"17일\"의 일은 요일이 아니므로 숫자 바로 뒤의 글자는 제외)
    const near = d.slice(Math.max(0, m.index - 14), m.index);
    let days = null;
    if (/주말/.test(near)) days = [0, 6];
    else if (/평일/.test(near)) days = [1, 2, 3, 4, 5];
    else {
      const toks = [...near.matchAll(/(?<![\d가-힣])([일월화수목금토])(?:요일|(?![가-힣]))/g)];
      const lastTok = toks[toks.length - 1];
      // 요일 표시가 시간대 바로 앞에 붙어 있을 때만 (사이에 다른 글이 끼면 다른 항목의 요일)
      const gapToSlot = lastTok ? near.slice(lastTok.index + lastTok[0].length) : '';
      if (toks.length && /^[\s:：(),\[\]|·-]{0,6}$/.test(gapToSlot)) {
        // 맨 뒤 요일부터 거슬러 올라가며, 쉼표·가운뎃점 등으로만 이어진 묶음만 취함
        const grp = [toks[toks.length - 1]];
        for (let i = toks.length - 2; i >= 0; i--) {
          const gap = near.slice(toks[i].index + toks[i][0].length, grp[0].index);
          if (/^[\s,·/、및와과~-]*$/.test(gap)) grp.unshift(toks[i]); else break;
        }
        days = [...new Set(grp.map((x) => DAYCH.indexOf(x[1])))].sort((x, y) => x - y);
      }
    }
    slots.push({ start, end, days });
    if (sources.length < 3) sources.push(snip(d, m.index, m[0].length));
  }
  // 시작 시각만 나열하고 소요 시간을 따로 적은 경우: "시간 : 10시, 13시, 15시 (약 90분 소요)" → 10:00–11:30, 13:00–14:30, 15:00–16:30
  const T1 = String.raw`(?:오전|오후)?\s*\d{1,2}\s*(?:시(?:\s*\d{1,2}\s*분|\s*반)?|:\d{2})`;
  const listRe = new RegExp(
    String.raw`(?:시\s*간|운영\s*시간|수업\s*시간|진행\s*시간)\s*[:：]?\s*((?:${T1}(?:\s*[,·/、]\s*|\s*및\s*)?){2,})\s*\(?\s*(?:각\s*|회당\s*|회차당\s*)?(?:약\s*)?(?:(\d{1,3})\s*분|(\d{1,2})\s*시간(?:\s*(\d{1,2})\s*분)?)\s*(?:소요|진행|동안|정도|내외)?`,
    'g',
  );
  let lm;
  while ((lm = listRe.exec(d))) {
    const dur = lm[2] ? +lm[2] : +lm[3] * 60 + (lm[4] ? +lm[4] : 0);
    if (!(dur >= 20 && dur <= 480)) continue;
    const startRe = new RegExp(`(오전|오후)?\\s*(\\d{1,2})\\s*(?::(\\d{2})|시(?:\\s*(\\d{1,2})\\s*분|\\s*(반))?)`, 'g');
    let sm;
    const found = [];
    while ((sm = startRe.exec(lm[1]))) {
      const H = to24(sm[1], +sm[2], (h) => (h >= 1 && h <= 7 ? h + 12 : h));
      const M = sm[3] != null ? +sm[3] : sm[4] != null ? +sm[4] : sm[5] ? 30 : 0;
      if (H > 23 || M > 59) continue;
      const startMin = H * 60 + M;
      const endMin = startMin + dur;
      if (endMin > 24 * 60 - 1) continue;
      found.push({ start: hhmm(H, M), end: hhmm(Math.floor(endMin / 60), endMin % 60), days: null });
    }
    if (found.length >= 2) {
      slots.push(...found);
      if (sources.length < 3) sources.push(snip(d, lm.index, lm[0].length));
    }
  }
  // 같은 시간대(같은 요일 표시)는 한 번만
  const seen = new Set();
  const uniq = slots.filter((s) => {
    const k = `${s.start}-${s.end}-${(s.days ?? []).join('')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { slots: uniq.sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end)), sources };
}

/**
 * 읽은 시간대를 API 의 시간 범위(vMin~vMax)와 맞춰 보고 쓸 만한 것만 남김.
 * - 서로 다른 시간대가 둘 이상이고, 모두 API 범위 안에 있을 때만 사용 (시설 이용시간 같은 걸 시각으로 오인하는 걸 막음)
 */
export function pickTimeSlots(detail, vMin, vMax) {
  if (!vMin || !vMax || vMin === '00:00') return null;
  const { slots, sources } = parseTimeSlots(detail);
  const lo = toMin(vMin);
  const hi = toMin(vMax);
  const inside = slots.filter((s) => toMin(s.start) >= lo && toMin(s.end) <= hi);
  if (inside.length < 2 || inside.length !== slots.length) return null;
  const distinct = new Set(inside.map((s) => `${s.start}-${s.end}`));
  if (distinct.size < 2) return null;
  return { slots: inside, sources };
}
