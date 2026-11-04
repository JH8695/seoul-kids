import { useMemo } from 'react';
import { occurrenceDates, toYmd } from '../lib/calendar';
import { weekendList } from '../lib/weekends';

const timeKey = (c) => (c.timeKnown && c.classStart ? c.classStart.slice(11, 16) : '99:99');
const md = (ymd) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}`;

/**
 * 주말 화면: 오늘부터 5번의 주말(토·일)에 열리는 프로그램만 날짜별로 모아 보여줘요.
 * rows 는 메인 화면의 필터(아이·분야·지역·이동시간·숨길 단어 …)가 이미 적용된 목록이에요.
 */
export default function WeekendView({ rows, renderItem, dayFilter = [], offDays = [], count = 5 }) {
  const today = useMemo(() => toYmd(new Date()), []);
  const offSet = useMemo(() => new Set(offDays), [offDays]);
  const weekends = useMemo(() => weekendList(today, count), [today, count]);

  // 날짜 → 그날 열리는 프로그램. 요일을 모르는 프로그램(loose)은 주말인지 알 수 없어서 따로 센다
  const { byDate, looseN } = useMemo(() => {
    const map = new Map();
    const want = new Set(weekends.flatMap((w) => w.days.map((d) => d.ymd)));
    const looseIds = new Set();
    for (const row of rows) {
      if (row.standing) continue; // 상시 운영은 날짜가 없어서 제외
      const o = occurrenceDates(row.course, row.daySet, today, row.tinfo);
      const hit = o.dates.filter((d) => want.has(d));
      if (o.loose && o.dates.length > 1) { if (hit.length) looseIds.add(row.course.id); continue; }
      for (const d of hit) {
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(row);
      }
    }
    for (const list of map.values()) list.sort((a, b) => timeKey(a.course).localeCompare(timeKey(b.course)));
    return { byDate: map, looseN: looseIds.size };
  }, [rows, weekends, today]);

  return (
    <div className="wk">
      <p className="wk-note">이번 주말부터 {weekends.length}번의 주말에 열리는 프로그램이에요. 위의 필터(아이·분야·지역·이동)가 그대로 적용돼요.</p>
      {weekends.map((w) => {
        const ids = new Set();
        w.days.forEach((d) => (byDate.get(d.ymd) ?? []).forEach((r) => ids.add(r.course.id)));
        return (
          <section key={w.days[0].ymd} className="wk-block" aria-label={w.label}>
            <h3 className="wk-head">
              <span className="wk-name">{w.label}</span>
              <span className="wk-range">{md(w.days[0].ymd)}{w.days.length > 1 ? `~${md(w.days[1].ymd)}` : ''}</span>
              <span className="wk-n">프로그램 {ids.size}개</span>
            </h3>
            {ids.size === 0 ? <p className="wk-none">이 주말에는 열리는 프로그램이 없어요</p> : w.days.map((d) => {
              const items = (byDate.get(d.ymd) ?? []).filter((r) => !dayFilter.length || dayFilter.includes(d.dow));
              const off = offSet.has(d.ymd);
              const head = (
                <h4 className={`wk-day${d.dow === 6 ? ' sat' : ' sun'}`}>
                  {d.dow === 6 ? '토' : '일'} {md(d.ymd)}
                  {off && <span className="wk-off">✕ 못 가는 날</span>}
                  <span className="wk-dn">{items.length}개</span>
                </h4>
              );
              if (!items.length) return <div key={d.ymd} className="wk-daybox">{head}<p className="wk-none">프로그램이 없어요</p></div>;
              const rowsEl = <div className="cal-rows">{items.map((r) => renderItem(r, d.ymd))}</div>;
              // 못 가는 날로 표시한 날은 접어 둠
              return off ? (
                <details key={d.ymd} className="wk-daybox off"><summary>{head}</summary>{rowsEl}</details>
              ) : (
                <div key={d.ymd} className="wk-daybox">{head}{rowsEl}</div>
              );
            })}
          </section>
        );
      })}
      {looseN > 0 && <p className="wk-note">요일을 몰라 주말인지 알 수 없는 프로그램 {looseN}개는 여기에 없어요. 목록에서 확인해 주세요.</p>}
    </div>
  );
}
