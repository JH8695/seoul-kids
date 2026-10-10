import { useEffect, useMemo, useState } from 'react';
import { AREA_CENTERS, CATEGORIES, HOME } from './data/config';
import { gradeOn, koreanAge, gradeLabel, matchTarget } from './lib/grade';
import { statusOf } from './lib/status';
import { audienceOf, REASON_LABEL } from './lib/audience';
import { distanceKm } from './lib/geo';
import { fmtFetchedAt, fmtStartTime, daysUntil } from './lib/format';
import { toYmd, dowOfYmd } from './lib/calendar';
import { chipLabel, extractTitleTarget, groupKeyOf, isOnline, titleInfo } from './lib/title';
import { useSettings } from './lib/useSettings';
import { useCourses } from './lib/useCourses';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard, { KidPills } from './components/CourseCard';
import GroupCard from './components/GroupCard';
import Settings from './components/Settings';
import CalendarView from './components/CalendarView';

const TABS = [
  { id: 'all', label: '전체' },
  { id: 'open', label: '접수중' },
  { id: 'upcoming', label: '접수예정' },
  { id: 'soon', label: '마감임박' },
];

const SORTS = [
  { id: 'apply', label: '접수 일정 순' },
  { id: 'use', label: '이용일 빠른 순' },
  { id: 'area', label: '가까운 구 순' },
];

const STATUS_LABEL = { open: '접수중', upcoming: '접수예정', full: '예약마감', closed: '종료' };
const DAYCH = '일월화수목금토';

function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

const ms = (iso) => (iso ? new Date(iso).getTime() : Infinity);
const timePart = (iso) => (iso ? iso.slice(11) : null); // "10:00:00+09:00"
// 우리 집이 있는 구는 항상 맨 앞, 나머지는 구 중심까지의 직선거리 순
const areaDist = (a) => (a && a === HOME.area ? -1 : a && AREA_CENTERS[a] ? distanceKm(HOME, AREA_CENTERS[a]) : Infinity);

export default function App() {
  const [settings, setSettings] = useSettings();
  const { courses, meta, loading } = useCourses();
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [scope, setScope] = useState('near'); // near | all
  const [sort, setSort] = useState('apply');
  const [view, setView] = useState('calendar'); // 폰 하단 탭: calendar | list
  const [cats, setCats] = useState([]);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [includeOpen, setIncludeOpen] = useState(false); // 대상 "제한없음"도 포함
  const [freeOnly, setFreeOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const days = settings.days ?? [];
  const phoneCalendar = !isDesktop && view === 'calendar';
  const effDays = useMemo(() => (phoneCalendar ? [] : days), [phoneCalendar, days]);
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const toggleCat = (id) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const favs = useMemo(() => new Set(settings.favs ?? []), [settings.favs]);

  // 샘플일 때는 샘플이 도심 쪽 기관 위주라서 처음부터 서울 전체로 보여줌
  // (불러오는 동안 잠깐 보이는 샘플 때문에 바뀌지 않도록, 불러오기가 끝난 뒤에만 판단)
  useEffect(() => { if (!loading && meta.isSample) setScope('all'); }, [loading, meta.isSample]);

  const nowMs = useMemo(() => Date.now(), []);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const todayYmd = useMemo(() => toYmd(now), [now]);

  const kids = settings.kids;
  const activeIds = useMemo(() => {
    const ids = kids.map((k) => k.id);
    const picked = (settings.activeKids ?? []).filter((id) => ids.includes(id));
    return picked.length ? picked : ids;
  }, [kids, settings.activeKids]);
  const toggleKid = (id) => {
    const next = activeIds.includes(id) ? activeIds.filter((x) => x !== id) : [...activeIds, id];
    setSettings({ ...settings, activeKids: next.length === kids.length || next.length === 0 ? [] : next });
  };

  // 프로그램마다: 제목에서 읽은 일정·학년, 지금 상태, 아이별 대상 판정, 요일, 거리, 묶음 열쇠
  const enriched = useMemo(
    () =>
      courses.map((c) => {
        const status = statusOf(c, nowMs);
        const tinfo = titleInfo(c, now.getFullYear());
        const online = isOnline(c);
        const titleTarget = extractTitleTarget(c.title);

        // 대상 판정에 쓸 기준일: 제목에 날짜가 있으면 그 날짜(오늘 이후 첫 날), 아니면 이용 시작일
        const firstDate = tinfo.dates ? tinfo.dates.find((d) => d >= todayYmd) ?? tinfo.dates[0] : null;
        const startMs = firstDate ? new Date(`${firstDate}T12:00:00+09:00`).getTime() : c.classStart ? new Date(c.classStart).getTime() : nowMs;
        const ref = new Date(Math.max(startMs, nowMs));

        let targetNote = null;
        const kidMatches = kids.map((kid) => {
          const g = gradeOn(kid.birthYear, ref);
          const age = koreanAge(kid.birthYear, ref);
          let match = matchTarget(c.targetText, g, age, kid.birthYear);
          if (match.result === 'check' && c.detailTarget) {
            const m2 = matchTarget(c.detailTarget, g, age, kid.birthYear);
            if (m2.result !== 'check') { match = m2; targetNote = '상세 설명 기준'; }
          }
          // 제목에 "초등 1~3학년"처럼 학년이 적혀 있으면 대상 칸보다 좁은 조건으로 봄
          if (titleTarget) {
            const m3 = matchTarget(titleTarget, g, age, kid.birthYear);
            if (m3.result === 'nomatch' && match.result !== 'nomatch') {
              match = { result: 'nomatch', tags: [...match.tags, '제목 기준'] };
              targetNote = '제목의 학년 기준';
            } else if (m3.result === 'match' && match.result === 'check') {
              match = m3;
              targetNote = '제목의 학년 기준';
            }
          }
          return { kid, grade: g, match };
        });
        const audience = audienceOf(c, kidMatches.filter((k) => activeIds.includes(k.kid.id)));

        // 요일: 제목 > 수집기가 읽은 요일 > 기간의 시작·끝 요일로 추정
        let daySet;
        if (tinfo.weekdays) daySet = new Set(tinfo.weekdays);
        else if (tinfo.dates) daySet = new Set(tinfo.dates.map(dowOfYmd));
        else if (tinfo.intervals) daySet = c.weekdays?.length ? new Set(c.weekdays) : null;
        else daySet = classWeekdays(c);

        // 화면에 보일 이용 일정: 제목에 날짜가 있으면 그 날짜로
        const disp = { ...c, status };
        if (tinfo.dates && c.classStart) {
          const use = tinfo.dates.filter((d) => d >= todayYmd);
          const ds = use.length ? use : tinfo.dates;
          disp.classStart = `${ds[0]}T${timePart(c.classStart)}`;
          disp.classEnd = `${ds[ds.length - 1]}T${timePart(c.classEnd ?? c.classStart)}`;
        }
        if (tinfo.weekdays && !disp.recurrence) {
          const names = tinfo.weekdays.map((d) => DAYCH[d]).join('·');
          disp.recurrence = tinfo.weekdays.length === 1 ? `${names}요일` : names;
        }
        const multiDay = c.classStart && c.classEnd && c.classStart.slice(0, 10) !== c.classEnd.slice(0, 10);
        return {
          course: disp,
          status,
          kidMatches,
          targetNote,
          audience,
          tinfo,
          daySet,
          online,
          needDetail: !daySet && !tinfo.dates && !!multiDay,
          groupKey: groupKeyOf(c),
          chip: chipLabel(c, tinfo),
          distance: online ? null : distanceKm(HOME, { lat: c.lat, lng: c.lng }),
        };
      }),
    [courses, kids, nowMs, activeIds, now, todayYmd],
  );

  const isOver = (e) =>
    (e.course.classEnd && toYmd(e.course.classEnd) < todayYmd) ||
    (e.tinfo.dates && e.tinfo.dates[e.tinfo.dates.length - 1] < todayYmd);
  const isFavRow = (e) => favs.has(e.groupKey) || favs.has(e.course.id);

  // 찜은 "같은 프로그램" 단위로 저장(나중에 같은 제목의 새 회차가 올라와도 따라옴)
  const toggleFav = (members) => {
    const on = members.some(isFavRow);
    const next = new Set(favs);
    if (on) {
      members.forEach((m) => { next.delete(m.groupKey); next.delete(m.course.id); });
    } else {
      next.add(members[0].groupKey);
    }
    setSettings({ ...settings, favs: [...next] });
  };

  // 검색어: 프로그램명·장소에서 찾음 (띄어쓰기·대소문자 무시)
  const norm = (x) => (x ?? '').toLowerCase().replace(/\s+/g, '');
  const q = norm(query);

  // 분야·상태 탭을 빼고 적용하는 공통 조건. countOpen=true 면 "제한없음 포함" 설정을 무시하고 셈(옆에 건수를 보여주려고)
  const pre = (skipCats, countOpen) =>
    enriched.filter((e) => {
      const c = e.course;
      if (isOver(e)) return false; // 이미 끝난 프로그램(회차)
      if (q && !norm(`${c.title} ${c.place}`).includes(q)) return false;
      if (favOnly) return isFavRow(e); // 찜 목록은 구·대상·분야 조건과 상관없이 보여줌
      if (scope === 'near' && c.area && !settings.areas.includes(c.area)) return false;
      if (freeOnly && !(/무료/.test(c.pay) && !/유료/.test(c.pay))) return false;
      if (!showAllTargets) {
        if (e.audience.kind === 'no') return false;
        if (e.audience.kind === 'open' && !includeOpen && !countOpen) return false;
      }
      if (!skipCats && cats.length && !c.tags?.some((t) => cats.includes(t))) return false;
      return passesDays(effDays, e.daySet);
    });

  const inTab = (e, id) => {
    if (id === 'open') return e.status === 'open';
    if (id === 'upcoming') return e.status === 'upcoming';
    if (id === 'soon') return e.status === 'open' && e.course.applyEnd && daysUntil(e.course.applyEnd, now) <= 3;
    return e.status === 'open' || e.status === 'upcoming' || showClosed || favOnly;
  };
  const countItems = (rows) => new Set(rows.map((e) => e.groupKey)).size; // 묶음 기준 개수

  const dep = [scope, settings.areas, showAllTargets, includeOpen, freeOnly, q, favOnly, favs, activeIds, effDays, todayYmd];
  /* eslint-disable */
  const base = useMemo(() => pre(false), [enriched, cats, ...dep]);
  const baseNoCats = useMemo(() => pre(true), [enriched, ...dep]);
  const openHidden = useMemo(
    () => countItems(pre(false, true).filter((e) => e.audience.kind === 'open' && inTab(e, tab))),
    [enriched, cats, tab, showClosed, ...dep],
  );
  const tabCounts = useMemo(() => {
    const m = {};
    TABS.forEach((t) => { m[t.id] = countItems(base.filter((e) => inTab(e, t.id))); });
    return m;
  }, [base, showClosed, favOnly]);
  const catCounts = useMemo(() => {
    const per = {};
    baseNoCats.filter((e) => inTab(e, tab)).forEach((e) => (e.course.tags ?? []).forEach((t) => { (per[t] ??= new Set()).add(e.groupKey); }));
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.size]));
  }, [baseNoCats, tab, showClosed, favOnly]);

  // 정렬한 회차 목록 (달력은 이 목록을 회차 하나하나로 씀)
  const list = useMemo(() => {
    const rows = base.filter((e) => inTab(e, tab));
    const nextAction = (e) => (e.status === 'open' ? ms(e.course.applyEnd) : e.status === 'upcoming' ? ms(e.course.applyStart) : Infinity);
    const key = sort === 'use' ? (e) => Math.max(ms(e.course.classStart), nowMs) : nextAction;
    return [...rows].sort((a, b) => key(a) - key(b) || ms(a.course.classStart) - ms(b.course.classStart));
  }, [base, tab, sort, showClosed, favOnly]);

  // 같은 프로그램의 회차끼리 묶음 (목록에서 처음 나오는 위치에 놓음)
  const items = useMemo(() => {
    const map = new Map();
    list.forEach((e) => { if (!map.has(e.groupKey)) map.set(e.groupKey, []); map.get(e.groupKey).push(e); });
    const firstDate = (e) => e.tinfo.dates?.[0] ?? e.course.classStart?.slice(0, 10) ?? '';
    return [...map.entries()].map(([key, members]) => ({
      key,
      members: [...members].sort((a, b) => (firstDate(a) < firstDate(b) ? -1 : firstDate(a) > firstDate(b) ? 1 : ms(a.course.applyStart) - ms(b.course.applyStart))),
    }));
  }, [list]);

  // "가까운 구 순": 구별로 묶고, 집에서 가까운 구부터
  const areaBuckets = useMemo(() => {
    if (sort !== 'area') return null;
    const m = new Map();
    items.forEach((it) => {
      const a = it.members[0].course.area || '';
      if (!m.has(a)) m.set(a, []);
      m.get(a).push(it);
    });
    return [...m.entries()]
      .sort(([a], [b]) => {
        const da = areaDist(a), db = areaDist(b);
        if (da === db) return a.localeCompare(b);
        return da < db ? -1 : 1;
      })
      .map(([area, its]) => ({ area, items: its }));
  }, [items, sort]);

  const favCount = useMemo(
    () => new Set(enriched.filter((e) => !isOver(e) && isFavRow(e)).map((e) => e.groupKey)).size,
    [enriched, favs, todayYmd],
  );
  /* eslint-enable */

  const statusCounts = useMemo(() => {
    const m = {};
    enriched.forEach((e) => { m[e.status] = (m[e.status] ?? 0) + 1; });
    return m;
  }, [enriched]);

  const renderCard = (e) => (
    <CourseCard
      key={e.course.id}
      course={e.course}
      status={e.status}
      kidMatches={e.kidMatches}
      targetNote={e.targetNote}
      audience={e.audience}
      distance={e.distance}
      home={HOME}
      needDetail={e.needDetail}
      online={e.online}
      fav={isFavRow(e)}
      onToggleFav={() => toggleFav([e])}
    />
  );

  const renderItem = (it) =>
    it.members.length > 1 ? (
      <GroupCard
        key={it.key}
        members={it.members}
        fav={it.members.some(isFavRow)}
        onToggleFav={() => toggleFav(it.members)}
        home={HOME}
      />
    ) : (
      renderCard(it.members[0])
    );

  const renderCompact = (e) => {
    const c = e.course;
    const time = fmtStartTime(c);
    return (
      <a key={c.id} className={`cal-row ${e.status}`} href={c.url} target="_blank" rel="noopener noreferrer">
        <span className={`badge ${e.status === 'open' ? 'open' : e.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
          {STATUS_LABEL[e.status]}
        </span>
        <span className="cal-row-title">{c.title}</span>
        <span className="cal-row-sub">{time && `${time} · `}{c.place}</span>
        <span className="cal-row-target">
          대상 {c.targetText || '원문 없음'}
          <KidPills kidMatches={e.kidMatches} />
          {e.audience.kind === 'no' && e.audience.reason && (
            <span className="pill bad">{REASON_LABEL[e.audience.reason]}</span>
          )}
        </span>
      </a>
    );
  };

  const hasErrors = meta.errors?.length > 0;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>서울 아이 체험</h1>
          <p className="sub">숲체험 · 박물관 · 어린이 체험 예약을 한곳에서</p>
        </div>
        <button className="grade-chip" onClick={() => setSettingsOpen(true)} aria-label="아이·지역 설정">
          설정
          <small>아이 {kids.length}명</small>
        </button>
      </header>

      {!loading && meta.isSample && (
        <div className="banner">
          지금 보이는 건 <strong>화면 확인용 샘플</strong>이에요(서울시 예약 사이트의 실제 프로그램 10건).
          인증키를 연결하면 전체 목록이 나와요.
        </div>
      )}
      {!meta.isSample && meta.fetchedAt && (
        <div className="banner ok">
          마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 프로그램 {courses.length}건
        </div>
      )}
      {hasErrors && (
        <div className="banner err">
          일부 정보를 가져오지 못했어요: {meta.errors.map((e) => `${e.source}${e.message ? ` (${e.message})` : ''}`).join(', ')}.
          목록에 빠진 프로그램이 있을 수 있어요.
        </div>
      )}

      <nav className="filters" aria-label="필터">
        <div className="searchrow">
          <input
            type="search"
            className="search"
            placeholder="프로그램명·장소 검색"
            aria-label="프로그램명·장소 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={`fav-toggle${favOnly ? ' on' : ''}`}
            aria-pressed={favOnly}
            onClick={() => setFavOnly((v) => !v)}
          >
            {favOnly ? '♥' : '♡'} 찜 {favCount}
          </button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
              {x.label} <span className="n">{tabCounts[x.id]}</span>
            </button>
          ))}
        </div>

        <div className="cats" role="group" aria-label="분야">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cats.includes(c.id)}
              className={`chip${cats.includes(c.id) ? ' on' : ''}`}
              onClick={() => toggleCat(c.id)}
            >
              <span aria-hidden>{c.emoji}</span> {c.label} <span className="n">{catCounts[c.id] ?? 0}</span>
            </button>
          ))}
          {cats.length > 0 && <button type="button" className="link-btn" onClick={() => setCats([])}>전체 분야</button>}
        </div>

        <div className="kids" role="group" aria-label="아이">
          <span className="days-label">아이</span>
          {kids.map((k) => {
            const g = gradeOn(k.birthYear, now);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={activeIds.includes(k.id)}
                className={`chip kid${activeIds.includes(k.id) ? ' on' : ''}`}
                onClick={() => toggleKid(k.id)}
              >
                {k.label} · {gradeLabel(g)}
              </button>
            );
          })}
        </div>

        <div className="row">
          <div className="seg" role="group" aria-label="지역">
            <button className={scope === 'near' ? 'on' : ''} onClick={() => setScope('near')}>선택한 구</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>서울 전체</button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
            {SORTS.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </select>
        </div>

        {scope === 'near' && !favOnly && (
          <p className="scope-hint">
            {settings.areas.length ? settings.areas.join(' · ') : '선택된 구가 없어요'}
            <button type="button" className="link-btn" onClick={() => setSettingsOpen(true)}>구 바꾸기</button>
          </p>
        )}

        {!phoneCalendar && (
          <div className="days" role="group" aria-label="이용 요일">
            <span className="days-label">요일</span>
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                className={`day${days.includes(d) ? ' on' : ''}${d === 0 ? ' sun' : d === 6 ? ' sat' : ''}`}
                onClick={() => toggleDay(d)}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
            {days.length > 0 && (
              <button type="button" className="link-btn" onClick={() => setSettings({ ...settings, days: [] })}>전체</button>
            )}
          </div>
        )}

        <div className="row checks">
          <label><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> 무료만 보기</label>
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 예약마감·종료 포함</label>
          <label><input type="checkbox" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} /> 대상 "제한없음"도 포함{openHidden > 0 && !includeOpen ? ` (${openHidden})` : ''}</label>
          <label><input type="checkbox" checked={showAllTargets} onChange={(e) => setShowAllTargets(e.target.checked)} /> 대상 안 맞는 것 포함 (단체·장애인 등)</label>
        </div>
      </nav>

      <main className="panes">
        <section className="pane-list" hidden={!isDesktop && view !== 'list'}>
          {items.length === 0 ? (
            <div className="empty">
              <h3>조건에 맞는 프로그램이 없어요</h3>
              <p>
                수집된 {courses.length}건 중 지금 조건에 맞는 게 없어요.
                {favOnly && ' 찜한 프로그램이 없거나 검색어에 맞는 게 없어요.'}
                {scope === 'near' && !favOnly && ' "서울 전체"로 바꿔 보세요.'}
                {!includeOpen && openHidden > 0 && ` 대상이 "제한없음"인 ${openHidden}건은 숨겨져 있어요.`}
                {q && ' 검색어를 지워 보세요.'}
              </p>
            </div>
          ) : areaBuckets ? (
            areaBuckets.map((b) => (
              <details className="area-group" key={b.area || 'none'} open>
                <summary>{b.area || '구 미표기'} <span className="n">{b.items.length}</span></summary>
                <div className="area-items">{b.items.map(renderItem)}</div>
              </details>
            ))
          ) : (
            items.map(renderItem)
          )}
          <details className="foot">
            <summary>수집 현황 (총 {courses.length}건)</summary>
            <p>
              상태별: 접수중 {statusCounts.open ?? 0} · 접수예정 {statusCounts.upcoming ?? 0} · 예약마감 {statusCounts.full ?? 0} · 접수종료 {statusCounts.closed ?? 0}
            </p>
            {meta.counts && (
              <p>
                {Object.entries(meta.counts).map(([k, v]) => `${k === 'education' ? '교육' : '문화행사'} ${v.kept}건(원본 ${v.read}건)`).join(' · ')}
              </p>
            )}
          </details>
          <p className="foot">
            예약과 신청은 서울시 예약 사이트에서 직접 해요. 이 앱은 로그인 정보를 받지 않아요.
            거리는 {HOME.name} 기준 직선거리(대략)예요.
          </p>
        </section>

        {isDesktop ? (
          <div className="pane-right">
            <section className="pane-cal" aria-label="달력">
              <CalendarView rows={list} renderItem={renderCompact} compact />
            </section>
          </div>
        ) : (
          view === 'calendar' && (
            <section className="pane-cal-m" aria-label="달력">
              <CalendarView rows={list} renderItem={renderCard} />
            </section>
          )
        )}
      </main>

      {!isDesktop && (
        <div className="viewbar">
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>달력</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>목록</button>
        </div>
      )}

      {settingsOpen && <Settings settings={settings} setSettings={setSettings} now={now} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
