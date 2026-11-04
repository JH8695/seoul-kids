// "주말" 화면: 오늘부터 앞으로 N번의 주말(토·일). 오늘이 일요일이면 이번 주말은 일요일 하루만, 토요일이면 토·일 모두.
const DAY = 86400000;
const parse = (ymd) => Date.parse(`${ymd}T00:00:00Z`);
const fmt = (t) => new Date(t).toISOString().slice(0, 10);

/** @returns { label, days: [{ ymd, dow(6=토,0=일) }] }[]  (지난 날은 빼고, 요일이 하나도 안 남는 주말은 없음) */
export function weekendList(todayYmd, count = 5) {
  const t0 = parse(todayYmd);
  const dow = new Date(t0).getUTCDay();
  // 이번 주말의 토요일: 일요일이면 어제(이미 지남), 그 외엔 오는 토요일
  const firstSat = dow === 0 ? t0 - DAY : t0 + ((6 - dow + 7) % 7) * DAY;
  const out = [];
  for (let i = 0; i < count; i++) {
    const sat = firstSat + i * 7 * DAY;
    const days = [{ ymd: fmt(sat), dow: 6 }, { ymd: fmt(sat + DAY), dow: 0 }].filter((d) => d.ymd >= todayYmd);
    if (!days.length) continue;
    const label = out.length === 0 ? '이번 주말' : out.length === 1 ? '다음 주말' : `${+fmt(sat).slice(5, 7)}월 ${+fmt(sat).slice(8, 10)}일 주말`;
    out.push({ label, days });
  }
  return out;
}
