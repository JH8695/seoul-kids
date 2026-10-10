// 상세 설명 글에서 "언제 열리는지"를 읽어요. 서울시 공개 데이터의 이용 기간은 사이트의 실제 이용기간과
// 다른 경우가 많아서(예: 9/25~10/24 로 나오지만 실제는 10/17, 10/24), 설명에 적힌 운영일이 더 정확해요.
//
// 지금까지 확인된 표기:
//   운영일 : 17일,24일(토)/14시~15시30분          (월은 제목의 "/10월" 에서)
//   운영일정 : 10월 토, 일                       (월 + 요일)
//   10월 6, 13, 27일 (화요일)                    (월 + 날짜들)
//   | 1 | 10월 17일(토) 14:00~15:20 | …            (표의 회차 줄)
//   운영시간: 매일 화~토                          (요일 범위 → 상시 운영 판정에 쓰임)
// 접수·신청·마감 같은 말 근처의 날짜(접수 기간 안내 등)는 운영일로 보지 않아요.
import { titleInfo } from '../src/lib/title.js';

const DAYCH = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dowOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

const SKIP_CONTEXT = /접수|신청|마감|모집|발표|취소|입금|결제|환불|추첨|선정|오픈|문의/;
const KEYWORD = /운영\s*일정?|운영일|운영\s*일시|수업\s*일시|수업일|진행일|교육일|교육\s*일시|일\s*시|일정|날짜|회차|강의일/;
const LABEL = '(?:\\(\\s*([일월화수목금토])\\s*(?:요일)?\\s*\\)|([일월화수목금토])요일)';
const SEP = '(?:\\s*[,·、/]\\s*|\\s*(?:및|와|과)\\s*|\\s+)';

// "8월 25일 10시~ 9월 28일", "3월 15일 부터 10월 25일" 같은 기간 표현의 양 끝은 운영일이 아님
function isRangePart(d, start, end) {
  const prev = d.slice(Math.max(0, start - 14), start).replace(/(?:20\d{2}\s*년\s*)?$/, '').trimEnd();
  const next = d.slice(end, end + 8);
  return /(?:~|∼|부터)$/.test(prev) || /^\s*(?:부터|~|∼)/.test(next);
}

const ymdOf = (iso) => (iso ? iso.slice(0, 10) : null);
const inWin = (ymd, s, e) => (!s || ymd >= s) && (!e || ymd <= e);

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

export function parseDetailSchedule(detail, { title = '', classStart = null, classEnd = null } = {}) {
  const d = String(detail ?? '').replace(/(\d)\s+일/g, '$1일').replace(/(\d)\s+월/g, '$1월');
  const s = ymdOf(classStart);
  const e = ymdOf(classEnd);
  const dates = new Set();
  const years = [...new Set([s && +s.slice(0, 4), e && +e.slice(0, 4)].filter(Boolean))];

  // 1) "10월 6, 13, 27일 (화요일)" / "10월 17일(토) 14:00~15:20"
  const listRe = new RegExp(
    String.raw`(\d{1,2})\s*월\s*((?:\d{1,2}\s*,\s*)*\d{1,2}\s*일\s*${LABEL}?(?:${SEP}\d{1,2}\s*일\s*${LABEL}?)*)`,
    'g',
  );
  let m;
  while ((m = listRe.exec(d))) {
    const before = d.slice(Math.max(0, m.index - 20), m.index);
    if (SKIP_CONTEXT.test(before) || isRangePart(d, m.index, m.index + m[0].length)) continue;
    const after = d.slice(m.index + m[0].length, m.index + m[0].length + 25);
    const items = readItems(m[2]);
    const hasLabel = items.some((i) => i.label);
    const hasTime = /\d{1,2}\s*[:시]\s*\d{0,2}/.test(after);
    const hasKeyword = KEYWORD.test(d.slice(Math.max(0, m.index - 30), m.index));
    if (!(hasLabel || hasTime || hasKeyword)) continue;
    for (const it of items) for (const y of years.length ? years : [new Date().getFullYear()]) pushDate(dates, y, +m[1], it.day, it.label, s, e);
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
    const items = readItems(m[1]);
    for (const it of items) {
      for (const [y, mo] of monthCands) {
        const before = dates.size;
        pushDate(dates, y, mo, it.day, it.label, s, e);
        if (dates.size > before) break; // 처음 맞는 달 하나만
      }
    }
  }

  // 3) "10/17(토)" 처럼 요일이 같이 적힌 날짜
  const slashRe = new RegExp(String.raw`(?<![\d/])(\d{1,2})\s*/\s*(\d{1,2})\s*${LABEL}`, 'g');
  while ((m = slashRe.exec(d))) {
    const before = d.slice(Math.max(0, m.index - 20), m.index);
    if (SKIP_CONTEXT.test(before) || isRangePart(d, m.index, m.index + m[0].length)) continue;
    for (const y of years) pushDate(dates, y, +m[1], +m[2], m[3] ?? m[4], s, e);
  }

  return { dates: dates.size ? [...dates].sort() : null, weekdays: parseDetailWeekdays(d) };
}

const DAYTOK = '[일월화수목금토](?:요일|(?![가-힣]))';

/** 설명의 "운영일정 : 10월 토, 일", "운영시간: 매일 화~토" 에서 요일을 읽음 (휴관 안내는 제외) */
export function parseDetailWeekdays(detail) {
  const d = String(detail ?? '');
  const closed = (text, end) => /^\s*(?:은|는)?\s*(?:휴관|휴무|휴원|쉽니다|쉬는)/.test(text.slice(end, end + 10));
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
    if (closed(d, m.index + m[0].length)) continue;
    return expand(m[1], m[2]);
  }
  // 나열 "토, 일" / "토요일"
  const listRe = new RegExp(String.raw`${head}((?:${DAYTOK})(?:\s*[,·/、]\s*(?:${DAYTOK}))*)`, 'g');
  while ((m = listRe.exec(d))) {
    if (closed(d, m.index + m[0].length)) continue;
    const days = [...new Set([...m[1]].filter((c) => DAYCH.includes(c)).map((c) => DAYCH.indexOf(c)))].sort((a, b) => a - b);
    if (days.length) return days;
  }
  // "주말" / "평일"
  const wk = new RegExp(String.raw`${head}(주말|평일)`).exec(d);
  if (wk) return wk[1] === '주말' ? [0, 6] : [1, 2, 3, 4, 5];
  return null;
}
