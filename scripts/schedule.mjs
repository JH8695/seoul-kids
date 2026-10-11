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
