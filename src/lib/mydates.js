// 사용자가 "내 날짜" 칸에 직접 적은 글에서 날짜를 읽습니다.
//   10/17   10월 17일   10.17   10/17, 10/24   10/17~10/20   10/17~20   10/17(토) 10/24(토)
// 연도는 적지 않아도 돼요. 프로그램의 이용 기간에 맞는 해로 채웁니다.
// 메모 글은 읽지 않아요("2명", "3시" 같은 숫자가 날짜로 잘못 읽히지 않도록).

const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const DOW = '일월화수목금토';
const dowOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

export const fmtMyDate = (ymd) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}(${DOW[dowOf(ymd)]})`;

// M/D → 이용 기간 안에 들어오는 해로 완성. 기간 밖이면 outside: true
function resolve(m, d, win, nowYear) {
  if (m < 1 || m > 12 || d < 1) return null;
  const years = [...new Set([win.s && +win.s.slice(0, 4), win.e && +win.e.slice(0, 4)].filter(Boolean))].sort();
  if (!years.length) years.push(nowYear);
  for (const y of years) {
    if (d > daysIn(y, m)) continue;
    const ymd = `${y}-${pad(m)}-${pad(d)}`;
    if ((!win.s || ymd >= win.s) && (!win.e || ymd <= win.e)) return { ymd, outside: false };
  }
  const y = years[0];
  if (d > daysIn(y, m)) return null;
  return { ymd: `${y}-${pad(m)}-${pad(d)}`, outside: true };
}

const MD = String.raw`(\d{1,2})\s*[\/.월]\s*(\d{1,2})\s*일?`;
const RANGE = new RegExp(String.raw`${MD}\s*[~～\-]\s*(?:(\d{1,2})\s*[\/.월]\s*)?(\d{1,2})\s*일?`, 'g');
const SINGLE = new RegExp(MD, 'g');

/** @returns { dates: {ymd, outside}[], bad: string } */
export function parseMyDates(text, course, nowYear = new Date().getFullYear()) {
  const win = { s: course.classStart?.slice(0, 10) ?? null, e: course.classEnd?.slice(0, 10) ?? null };
  const out = new Map();
  let rest = String(text ?? '').replace(/\([^)]*\)/g, ' '); // 괄호 안(요일)은 무시

  rest = rest.replace(RANGE, (m, m1, d1, m2, d2) => {
    const a = resolve(+m1, +d1, win, nowYear);
    const b = resolve(+(m2 ?? m1), +d2, win, nowYear);
    if (!a || !b || a.ymd > b.ymd) return m; // 못 읽은 것은 남겨 둠
    let t = Date.parse(`${a.ymd}T00:00:00Z`);
    const end = Date.parse(`${b.ymd}T00:00:00Z`);
    for (let i = 0; t <= end && i < 90; i++, t += 86400000) {
      const ymd = new Date(t).toISOString().slice(0, 10);
      out.set(ymd, { ymd, outside: !!((win.s && ymd < win.s) || (win.e && ymd > win.e)) });
    }
    return ' ';
  });
  rest = rest.replace(SINGLE, (m, mm, dd) => {
    const r = resolve(+mm, +dd, win, nowYear);
    if (!r) return m;
    out.set(r.ymd, r);
    return ' ';
  });

  const bad = rest.replace(/[\s,，;·、\/]+/g, ' ').trim();
  return { dates: [...out.values()].sort((x, y) => (x.ymd < y.ymd ? -1 : 1)), bad };
}
