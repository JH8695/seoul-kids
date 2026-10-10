import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, HOME } from './data/config';
import { gradeOn, koreanAge, gradeLabel, matchTarget } from './lib/grade';
import { statusOf } from './lib/status';
import { distanceKm } from './lib/geo';
import { fmtFetchedAt, fmtStartTime, daysUntil } from './lib/format';
import { toYmd } from './lib/calendar';
import { useSettings } from './lib/useSettings';
import { useCourses } from './lib/useCourses';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard from './components/CourseCard';
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
  { id: 'near', label: '가까운 순' },
];

const STATUS_LABEL = { open: '접수중', upcoming: '접수예정', full: '예약마감', closed: '종료' };

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

export default function App() {
  const [settings, setSettings] = useSettings();
  const { courses, meta } = useCourses();
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [scope, setScope] = useState('near'); // near | all
  const [sort, setSort] = useState('apply');
  const [view, setView] = useState('calendar'); // 폰 하단 탭: calendar | list
  const [cats, setCats] = useState([]);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const days = settings.days ?? [];
  const phoneCalendar = !isDesktop && view === 'calendar';
  const effDays = useMemo(() => (phoneCalendar ? [] : days), [phoneCalendar, days]);
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const toggleCat = (id) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  // 샘플일 때는 샘플이 도심 쪽 기관 위주라서 처음부터 서울 전체로 보여줌
  useEffect(() => { if (meta.isSample) setScope('all'); }, [meta.isSample]);

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

  // 프로그램마다: 지금 상태, 아이별 대상 판정(이용 시작일 기준 학년), 요일, 거리
  const enriched = useMemo(
    () =>
      courses.map((c) => {
        const status = statusOf(c, nowMs);
        const ref = new Date(Math.max(c.classStart ? new Date(c.classStart).getTime() : nowMs, nowMs));
        let targetNote = null;
        const kidMatches = kids.map((kid) => {
          const g = gradeOn(kid.birthYear, ref);
          const age = koreanAge(kid.birthYear, ref);
          let match = matchTarget(c.targetText, g, age, kid.birthYear);
          if (match.result === 'check' && c.detailTarget) {
            const m2 = matchTarget(c.detailTarget, g, age, kid.birthYear);
            if (m2.result !== 'check') { match = m2; targetNote = '상세 설명 기준'; }
          }
          return { kid, grade: g, match };
        });
        return {
          course: { ...c, status },
          status,
          kidMatches,
          targetNote,
          daySet: classWeekdays(c),
          distance: distanceKm(HOME, { lat: c.lat, lng: c.lng }),
        };
      }),
    [courses, kids, nowMs],
  );

  // 분야·상태 탭을 빼고 적용하는 공통 조건
  const pre = (skipCats) =>
    enriched.filter((e) => {
      const c = e.course;
      if (c.classEnd && toYmd(c.classEnd) < todayYmd) return false; // 이미 끝난 프로그램
      if (scope === 'near' && c.area && !settings.areas.includes(c.area)) return false;
      if (
        !showAllTargets &&
        !e.kidMatches.some((k) => activeIds.includes(k.kid.id) && k.match.result !== 'nomatch')
      ) return false;
      if (!skipCats && cats.length && !c.tags?.some((t) => cats.includes(t))) return false;
      return passesDays(effDays, e.daySet);
    });

  const inTab = (e, id) => {
    if (id === 'open') return e.status === 'open';
    if (id === 'upcoming') return e.status === 'upcoming';
    if (id === 'soon') return e.status === 'open' && e.course.applyEnd && daysUntil(e.course.applyEnd, now) <= 3;
    return e.status === 'open' || e.status === 'upcoming' || showClosed;
  };

  const base = useMemo(() => pre(false), [enriched, scope, settings.areas, showAllTargets, activeIds, cats, effDays, todayYmd]); // eslint-disable-line
  const baseNoCats = useMemo(() => pre(true), [enriched, scope, settings.areas, showAllTargets, activeIds, effDays, todayYmd]); // eslint-disable-line

  const tabCounts = useMemo(() => {
    const m = {};
    TABS.forEach((t) => { m[t.id] = base.filter((e) => inTab(e, t.id)).length; });
    return m;
  }, [base, showClosed]); // eslint-disable-line

  const catCounts = useMemo(() => {
    const m = {};
    baseNoCats.filter((e) => inTab(e, tab)).forEach((e) => (e.course.tags ?? []).forEach((t) => { m[t] = (m[t] ?? 0) + 1; }));
    return m;
  }, [baseNoCats, tab, showClosed]); // eslint-disable-line

  const list = useMemo(() => {
    const rows = base.filter((e) => inTab(e, tab));
    const nextAction = (e) => (e.status === 'open' ? ms(e.course.applyEnd) : e.status === 'upcoming' ? ms(e.course.applyStart) : Infinity);
    const key = {
      apply: nextAction,
      use: (e) => Math.max(ms(e.course.classStart), nowMs),
      near: (e) => e.distance ?? Infinity,
    }[sort];
    return [...rows].sort((a, b) => key(a) - key(b) || ms(a.course.classStart) - ms(b.course.classStart));
  }, [base, tab, sort, showClosed]); // eslint-disable-line

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
      distance={e.distance}
      home={HOME}
    />
  );

  const renderCompact = (e) => {
    const c = e.course;
    const time = c.timeKnown ? fmtStartTime(c) : '';
    return (
      <a key={c.id} className={`cal-row ${e.status}`} href={c.url} target="_blank" rel="noopener noreferrer">
        <span className={`badge ${e.status === 'open' ? 'open' : e.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
          {STATUS_LABEL[e.status]}
        </span>
        <span className="cal-row-title">{c.title}</span>
        <span className="cal-row-sub">{time && `${time} · `}{c.place}</span>
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

      {meta.isSample && (
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
            <button className={scope === 'near' ? 'on' : ''} onClick={() => setScope('near')}>강남·주변</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>서울 전체</button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
            {SORTS.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </select>
        </div>

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
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 예약마감·종료 포함</label>
          <label><input type="checkbox" checked={showAllTargets} onChange={(e) => setShowAllTargets(e.target.checked)} /> 대상 안 맞는 것 포함</label>
        </div>
      </nav>

      <main className="panes">
        <section className="pane-list" hidden={!isDesktop && view !== 'list'}>
          {list.length === 0 ? (
            <div className="empty">
              <h3>조건에 맞는 프로그램이 없어요</h3>
              <p>
                수집된 {courses.length}건 중 지금 조건에 맞는 게 없어요.
                {scope === 'near' && ' "서울 전체"로 바꿔 보세요.'}
                {cats.length > 0 && ' 분야 선택을 해제하면 더 보여요.'}
                {!showAllTargets && ' "대상 안 맞는 것 포함"을 켜면 전체를 볼 수 있어요.'}
              </p>
            </div>
          ) : (
            list.map(renderCard)
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
