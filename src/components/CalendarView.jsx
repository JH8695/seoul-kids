import { useEffect, useMemo, useState } from 'react';
import { DAY_LABELS } from '../lib/weekdays';
import { monthGrid, monthKey, occurrenceDates, toYmd, dowOfYmd } from '../lib/calendar';
import { compareAreas } from '../lib/areas';
import AreaGroup from './AreaGroup';

const HEAD = [0, 1, 2, 3, 4, 5, 6]; // 일~토

const timeKey = (c) => (c.timeKnown && c.classStart ? c.classStart.slice(11, 16) : '99:99');

export default function CalendarView({ rows, renderItem, compact = false, groupByArea = false, collapsed = new Set(), onToggleArea = () => {}, focusDate = null }) {
  const today = useMemo(() => toYmd(new Date()), []);
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) }));
  const [sel, setSel] = useState(today);

  // 카드의 날짜를 눌러 들어오면 그 달·그 날짜로 이동
  useEffect(() => {
    if (!focusDate?.ymd) return;
    setCursor({ y: +focusDate.ymd.slice(0, 4), m: +focusDate.ymd.slice(5, 7) });
    setSel(focusDate.ymd);
  }, [focusDate]);

  // 상시 운영(한 달 내내 열려 있는 시설 예약)은 달력 숫자에서 빼고, 선택한 날 아래에 따로 모아 접어 둠
  const normalRows = useMemo(() => rows.filter((r) => !r.standing), [rows]);
  const standingRows = useMemo(() => rows.filter((r) => r.standing), [rows]);

  // 날짜 → 그날 열리는 프로그램들 ({ row, loose })
  const { byDate, anyEstimated, anyLoose } = useMemo(() => {
    const map = new Map();
    let est = false;
    let loose = false;
    for (const row of normalRows) {
      const o = occurrenceDates(row.course, row.daySet, today, row.tinfo);
      if (o.estimated && o.dates.length > 1) est = true;
      if (o.loose && o.dates.length > 1) loose = true;
      for (const d of o.dates) {
        if (!map.has(d)) map.set(d, []);
        map.get(d).push({ row, loose: o.loose && o.dates.length > 1 });
      }
    }
    return { byDate: map, anyEstimated: est, anyLoose: loose };
  }, [normalRows, today]);

  const key = monthKey(cursor.y, cursor.m);
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const monthCount = useMemo(() => {
    const ids = new Set();
    for (const [d, items] of byDate) if (d.startsWith(key)) items.forEach((x) => ids.add(x.row.course.id));
    return ids.size;
  }, [byDate, key]);

  // 앞뒤 달에 몇 개가 있는지 (이 달 밖에 있는 프로그램을 놓치지 않게)
  const monthN = (delta) => {
    const n = cursor.y * 12 + (cursor.m - 1) + delta;
    const y = Math.floor(n / 12);
    const m = (n % 12) + 1;
    const k = monthKey(y, m);
    const ids = new Set();
    for (const [d, items] of byDate) if (d.startsWith(k)) items.forEach((x) => ids.add(x.row.course.id));
    return { m, n: ids.size };
  };
  const prevM = monthN(-1);
  const nextM = monthN(1);

  const move = (delta) =>
    setCursor(({ y, m }) => {
      const n = y * 12 + (m - 1) + delta;
      return { y: Math.floor(n / 12), m: (n % 12) + 1 };
    });

  // 이 달에 프로그램이 없을 때: 가장 가까운 달 찾기
  const nearest = useMemo(() => {
    if (monthCount > 0 || byDate.size === 0) return null;
    const keys = [...byDate.keys()].sort();
    const next = keys.find((d) => d >= `${key}-01`) ?? keys[keys.length - 1];
    return { y: +next.slice(0, 4), m: +next.slice(5, 7) };
  }, [monthCount, byDate, key]);

  const sorted = useMemo(
    () => [...(byDate.get(sel) ?? [])].sort((a, b) => timeKey(a.row.course).localeCompare(timeKey(b.row.course))),
    [byDate, sel],
  );
  const sure = sorted.filter((x) => !x.loose);
  const loose = sorted.filter((x) => x.loose);
  const selDow = sel ? dowOfYmd(sel) : null;
  const itemsClass = compact ? 'cal-rows' : 'cal-day-list';
  // 가까운 구 순 정렬일 때는 구 제목 아래로 묶어 접고 펼 수 있게(목록과 같은 접힘 상태)
  const renderRows = (list) => {
    if (!groupByArea) return <div className={itemsClass}>{list.map((r) => renderItem(r))}</div>;
    const m = new Map();
    list.forEach((r) => {
      const a = r.course.area || '';
      if (!m.has(a)) m.set(a, []);
      m.get(a).push(r);
    });
    return [...m.entries()]
      .sort(([a], [b]) => compareAreas(a, b))
      .map(([a, rs]) => (
        <AreaGroup key={a || 'none'} area={a} count={rs.length} collapsed={collapsed.has(a)} onToggle={onToggleArea} itemsClass={itemsClass}>
          {rs.map((r) => renderItem(r))}
        </AreaGroup>
      ));
  };
  const standingToday = useMemo(
    () =>
      standingRows.filter((r) => {
        if (!r.course.classStart) return false;
        const s = toYmd(r.course.classStart);
        const e = r.course.classEnd ? toYmd(r.course.classEnd) : s;
        return sel >= s && sel <= e;
      }),
    [standingRows, sel],
  );

  return (
    <div className={`cal${compact ? ' compact' : ''}`}>
      <div className="cal-head">
        <button type="button" className="cal-nav wide" onClick={() => move(-1)} aria-label={`이전 달 ${prevM.m}월, 프로그램 ${prevM.n}개`}>
          ‹ {prevM.m}월{prevM.n > 0 && <b className="cal-n">{prevM.n}</b>}
        </button>
        <div className="cal-title">
          <strong>{cursor.y}년 {cursor.m}월</strong>
          <small>
            이 달 프로그램 {monthCount}개 ·{' '}
            <button type="button" className="link-btn" onClick={() => { setCursor({ y: +today.slice(0, 4), m: +today.slice(5, 7) }); setSel(today); }}>오늘</button>
          </small>
        </div>
        <button type="button" className="cal-nav wide" onClick={() => move(1)} aria-label={`다음 달 ${nextM.m}월, 프로그램 ${nextM.n}개`}>
          {nextM.m}월{nextM.n > 0 && <b className="cal-n">{nextM.n}</b>} ›
        </button>
      </div>

      <div className="cal-grid cal-dow" aria-hidden="true">
        {HEAD.map((d) => (
          <span key={d} className={d === 6 ? 'sat' : d === 0 ? 'sun' : ''}>{DAY_LABELS[d]}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid" aria-label={`${cursor.y}년 ${cursor.m}월 달력`}>
        {cells.map((ymd, i) => {
          if (!ymd) return <span key={`e${i}`} className="cal-cell empty" />;
          const items = byDate.get(ymd) ?? [];
          const sureItems = items.filter((x) => !x.loose);
          const pick = sureItems.length ? sureItems : items;
          const tone = pick.some((x) => x.row.course.status === 'open')
            ? 'open'
            : pick.some((x) => x.row.course.status === 'upcoming')
            ? 'upcoming'
            : items.length
            ? 'closed'
            : '';
          const col = i % 7;
          return (
            <button
              key={ymd}
              type="button"
              className={`cal-cell${ymd === today ? ' today' : ''}${ymd === sel ? ' sel' : ''}${col === 6 ? ' sat' : col === 0 ? ' sun' : ''}`}
              onClick={() => setSel(ymd)}
              aria-label={`${+ymd.slice(5, 7)}월 ${+ymd.slice(8, 10)}일, 프로그램 ${sureItems.length}개${items.length > sureItems.length ? `, 기간 중 운영 ${items.length - sureItems.length}개` : ''}`}
              aria-pressed={ymd === sel}
            >
              <span className="cal-num">{+ymd.slice(8, 10)}</span>
              {items.length > 0 && (
                <span className={`cal-pill ${tone}${sureItems.length === 0 ? ' soft' : ''}`}>{items.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="cal-pill open" /> 접수중</span>
        <span><i className="cal-pill upcoming" /> 접수예정</span>
        <span><i className="cal-pill closed" /> 마감·종료</span>
        <span><i className="cal-pill soft" /> 기간 중 운영(요일 확인)</span>
      </div>

      {nearest && (
        <button type="button" className="outline" onClick={() => setCursor(nearest)}>
          이 달엔 프로그램이 없어요 · 가장 가까운 {nearest.m}월로 이동
        </button>
      )}

      {sel && (
        <section className="cal-day" aria-live="polite">
          <h3>
            {+sel.slice(5, 7)}월 {+sel.slice(8, 10)}일({DAY_LABELS[selDow]}) · 프로그램 {sorted.length}개
          </h3>
          {sorted.length === 0 ? (
            <p className="hint">이 날 열리는 프로그램이 없어요.</p>
          ) : (
            <>
              {sure.length > 0 && (
                renderRows(sure.map((x) => x.row))
              )}
              {loose.length > 0 && (
                <>
                  <h4 className="cal-sub">기간 중 운영 · 이 날 열리는지는 상세 확인</h4>
                  {renderRows(loose.map((x) => x.row))}
                </>
              )}
            </>
          )}
          {standingToday.length > 0 && (
            <details className="standing">
              <summary>상시 운영 {standingToday.length}개 · 눌러서 펼치기</summary>
              {renderRows(standingToday)}
            </details>
          )}
        </section>
      )}

      {(anyEstimated || anyLoose) && (
        <p className="hint">
          {anyEstimated && '"매주 ○요일"이라고 적혀 있지 않은 기간 프로그램은 시작·종료 요일이 같으면 그 요일에 열리는 것으로 추정해요. "격주"는 격주로 열려요. '}
          {anyLoose && '서울시 목록에는 이용 "기간"만 있고 요일이 없는 프로그램은 기간 안의 모든 날에 연하게 표시해요. 정확한 날짜는 예약 사이트에서 확인하세요.'}
        </p>
      )}
    </div>
  );
}
