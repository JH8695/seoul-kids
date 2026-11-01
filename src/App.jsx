import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, HOME } from './data/config';
import { gradeOn, koreanAge, gradeLabel, matchTarget } from './lib/grade';
import { statusOf } from './lib/status';
import { audienceOf, REASON_LABEL } from './lib/audience';
import { distanceKm } from './lib/geo';
import { compareAreas } from './lib/areas';
import { fmtMyDate } from './lib/mydates';
import { fmtDate, fmtFetchedAt, fmtStartTime, fmtTime, daysUntil } from './lib/format';
import { classifyBusy, cleanBusy } from './lib/busy';
import { cleanPlaces, listPlaces, placeKeyOf, placeName, placeState, withPlace } from './lib/places';
import { addRecent, cleanSearches, removeTerm, togglePin } from './lib/searches';
import { isNewId, updateSeen } from './lib/firstSeen';
import { dateTrust } from './lib/dateTrust';
import { toYmd, dowOfYmd, occurrenceDates } from './lib/calendar';
import { chipLabel, extractTitleTarget, groupKeyOf, isOnline, isStanding, titleInfo } from './lib/title';
import { applyFit, applyTime, daysLabel, editLabels, forcedMatch } from './lib/edits';
import { useSettings } from './lib/useSettings';
import { useSync } from './lib/useSync';
import { parseShareHash } from './lib/backup';
import { mergeUnion, pickSync } from './lib/sync';
import { useCourses } from './lib/useCourses';
import { DAY_LABELS, DAY_ORDER, classWeekdays, passesDays } from './lib/weekdays';
import CourseCard, { KidPills } from './components/CourseCard';
import GroupCard from './components/GroupCard';
import PlacesPage from './components/PlacesPage';
import Settings from './components/Settings';
import CalendarView from './components/CalendarView';
import AppSwitcher from './components/AppSwitcher';
import AreaGroup from './components/AreaGroup';
import AreaPicker from './components/AreaPicker';
import NoteSheet from './components/NoteSheet';
import Sheet from './components/Sheet';

const TABS = [
  { id: 'all', label: '전체' },
  { id: 'open', label: '접수중' },
  { id: 'upcoming', label: '접수예정' },
  { id: 'soon', label: '마감임박' },
];

const SORTS = [
  { id: 'area', label: '가까운 구 순' },
  { id: 'apply', label: '접수 일정 순' },
  { id: 'use', label: '이용일 빠른 순' },
];

const STATUS_LABEL = { open: '접수중', upcoming: '접수예정', full: '예약마감', closed: '종료' };
const DAYCH = '일월화수목금토';
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

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

export default function App() {
  const [settings, setSettings, applyRemote] = useSettings();
  const sync = useSync(settings, applyRemote); // 구글 로그인 동기화 (로그인 전에는 아무것도 불러오지 않음)
  const { courses, meta, loading } = useCourses();
  const isDesktop = useMedia('(min-width: 900px)');

  const [tab, setTab] = useState('all');
  const [scope, setScope] = useState('near'); // near | all
  const [sort, setSort] = useState('area'); // 항상 "가까운 구 순"으로 시작
  const [view, setView] = useState('list'); // 폰 하단 탭: calendar | list (처음엔 목록)
  const [cats, setCats] = useState([]);
  const [showClosed, setShowClosed] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [includeOpen, setIncludeOpen] = useState(false); // 대상 "제한없음"도 포함
  const [freeOnly, setFreeOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [placeOnly, setPlaceOnly] = useState(false); // ★ 관심 장소만 보기
  const [searchFocus, setSearchFocus] = useState(false);
  const FILTERS_KEY = 'seoulkids:filtersOpen';
  const [filtersOpen, setFiltersOpen] = useState(() => { try { return localStorage.getItem(FILTERS_KEY) !== '0'; } catch { return true; } });
  const toggleFilters = () => setFiltersOpen((v) => {
    try { localStorage.setItem(FILTERS_KEY, v ? '0' : '1'); } catch { /* 저장 불가 환경 */ }
    return !v;
  });
  const [placesOpen, setPlacesOpen] = useState(false); // 업체(장소) 목록 페이지
  const [placeFocus, setPlaceFocus] = useState(null); // { key, name }: 이 장소의 프로그램만 보기
  const [showHidden, setShowHidden] = useState(false); // 숨긴 프로그램만 보기(되살리기용)
  const [optionsOpen, setOptionsOpen] = useState(false); // PC "옵션" 창
  const [toast, setToast] = useState(null); // 방금 숨긴 것 { kind: 'group'|'rounds', key?, ids?, text } — 되돌리기 안내
  const [sheet, setSheet] = useState(null); // 폰 필터 선택 창: cats | kids | area | options
  const [noteFor, setNoteFor] = useState(null); // 메모 창을 연 회차(예약 id)
  const [collapsedAreas, setCollapsedAreas] = useState(() => new Set()); // 접어 둔 구(목록·달력 공통)
  const unknownRef = useRef(null);
  const standingRef = useRef(null);
  const openFold = (ref) => {
    if (!ref.current) return;
    ref.current.open = true;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [calendarFocus, setCalendarFocus] = useState(null); // 카드의 날짜를 눌러 달력으로 이동 { ymd, n }
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 접수 상태 안내(한 줄 공지): 닫으면 그날은 다시 안 나오고, 다음 날 열면 다시 보여줘요
  const [noticeOpen, setNoticeOpen] = useState(() => {
    try { return localStorage.getItem('seoulkids:notice:day') !== toYmd(new Date()); } catch { return true; }
  });
  const dismissNotice = () => {
    setNoticeOpen(false);
    try { localStorage.setItem('seoulkids:notice:day', toYmd(new Date())); } catch { /* ignore */ }
  };

  const days = settings.days ?? [];
  const phoneCalendar = !isDesktop && view === 'calendar';
  // 요일을 7개 모두 고르는 것은 "요일 필터 없음"과 같아요 (그대로 두면 요일을 모르는 프로그램이 모두 접혀 버림)
  const allDays = days.length === 0 || days.length >= 7;
  const effDays = useMemo(() => (phoneCalendar || days.length >= 7 ? [] : days), [phoneCalendar, days]);
  const toggleDay = (d) =>
    setSettings({ ...settings, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const toggleCat = (id) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const favs = useMemo(() => new Set(settings.favs ?? []), [settings.favs]);
  const hiddenSet = useMemo(() => new Set(settings.hidden ?? []), [settings.hidden]);
  const hiddenRoundSet = useMemo(() => new Set(settings.hiddenRounds ?? []), [settings.hiddenRounds]);
  const bothKids = settings.bothKids === true; // 아이를 둘 이상 골랐을 때 모두 갈 수 있는 것만
  const busyList = useMemo(() => cleanBusy(settings.busy), [settings.busy]);
  const places = useMemo(() => cleanPlaces(settings.places), [settings.places]);
  const searches = useMemo(() => cleanSearches(settings.searches), [settings.searches]);
  const favPlaces = useMemo(() => listPlaces(places, 'fav'), [places]);

  // 처음 본 시각(이 기기에만 저장): 새로 올라온 프로그램에 NEW 를 붙이려고
  const SEEN_KEY = 'seoulkids:seen:v1';
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { return null; } });
  useEffect(() => {
    if (loading || meta.isSample || !courses.length) return; // 불러오는 중·샘플·빈 목록일 땐 기록하지 않음(전부 NEW 로 뜨는 걸 막음)
    const next = updateSeen(seen, courses.map((c) => c.id));
    if (next !== seen) {
      setSeen(next);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* 저장 불가 환경 */ }
    }
  }, [courses, loading, meta.isSample]); // eslint-disable-line react-hooks/exhaustive-deps
  const notes = settings.notes ?? {};
  const toggleAreaCollapse = (area, collapse) =>
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (collapse) next.add(area); else next.delete(area);
      return next;
    });

  // 샘플일 때는 샘플이 도심 쪽 기관 위주라서 처음부터 서울 전체로 보여줌
  // (불러오는 동안 잠깐 보이는 샘플 때문에 바뀌지 않도록, 불러오기가 끝난 뒤에만 판단)
  useEffect(() => { if (!loading && meta.isSample) setScope('all'); }, [loading, meta.isSample]);

  // 합치기 링크(#import=...)로 열었으면: 이 기기의 찜·숨김·메모에 합침 (지금 있는 내용은 지우지 않음)
  useEffect(() => {
    if (!window.location.hash.startsWith('#import=')) return;
    const r = parseShareHash(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (r.error) { window.alert(r.error); return; }
    if (!window.confirm('링크에 담긴 찜·숨김·메모를 이 기기에 합칠까요?\n(지금 있는 내용은 지워지지 않아요)')) return;
    setSettings((cur) => ({ ...cur, ...mergeUnion(pickSync(cur), r.settings, { prefs: 'local' }) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!optionsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOptionsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [optionsOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

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
        // 내가 적은 날짜가 있으면 제목에서 읽은 일정보다 항상 우선
        const note = notes[c.id] ?? null;
        const myDates = note?.dates?.length ? [...note.dates].sort() : null;
        const editDays = !myDates && note?.days?.length ? note.days : null; // 내가 고친 요일(+몇째 주)
        // 우선순위: 내 날짜 > 제목에 적힌 날짜 > 상세 설명에서 읽은 운영일 > 제목의 월·요일
        const titleBase = titleInfo(c, now.getFullYear());
        let tinfo = titleBase;
        let dateSource = null;
        if (myDates) { tinfo = { dates: myDates, intervals: null, weekdays: null }; dateSource = 'mine'; }
        else if (editDays) {
          // 내가 요일을 고쳤으면 제목·설명에서 읽은 날짜보다 우선 (매주/몇째 주 반복으로 계산)
          tinfo = { dates: null, intervals: titleBase.intervals, weekdays: editDays, weekOfMonth: note.weeks?.length ? note.weeks : [] };
          dateSource = 'edit';
        } else if (titleBase.dates) dateSource = 'title';
        else if (c.detailDates?.length) { tinfo = { dates: c.detailDates, intervals: null, weekdays: null }; dateSource = 'detail'; }
        // 날짜 계산 규칙: 몇째 주 · 제외하는 달 · 휴강일 (내가 적은 날짜에는 적용하지 않음)
        if (!myDates) {
          tinfo = {
            ...tinfo,
            weekOfMonth: tinfo.weekOfMonth ?? (c.weekOfMonth?.length ? c.weekOfMonth : null),
            excludeDates: c.detailClosed ?? null,
            excludeMonths: c.excludeMonths ?? null,
          };
        }
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
        // 내가 고친 대상(아이별 "해당"/"해당 안 됨")이 자동 판정보다 우선
        const autoKidMatches = kidMatches;
        const kidMatchesF = applyFit(kidMatches, note);
        const activeKm = kidMatchesF.filter((k) => activeIds.includes(k.kid.id));
        let audience = audienceOf(c, activeKm);
        if (forcedMatch(activeKm)) audience = { kind: 'kid', note: '내 수정: 해당' }; // 단체·성인 대상·제한없음 자동 숨김도 풀림
        // "둘 다 가능": 고른 아이 중 한 명이라도 대상이 아니면 숨김("확인 필요"는 남김)
        if (bothKids && activeKm.length > 1 && audience.kind !== 'no' && activeKm.some((k) => k.match.result === 'nomatch')) {
          audience = { kind: 'no', reason: 'bothKids' };
        }

        // 요일: 제목 > 수집기가 읽은 요일 > 기간의 시작·끝 요일로 추정
        let daySet;
        if (tinfo.weekdays) daySet = new Set(tinfo.weekdays);
        else if (tinfo.dates) daySet = new Set(tinfo.dates.map(dowOfYmd));
        else if (tinfo.intervals) daySet = c.weekdays?.length ? new Set(c.weekdays) : null;
        else daySet = classWeekdays(c);

        // 화면에 보일 이용 일정: 제목에 날짜가 있으면 그 날짜로
        let disp = { ...c, status };
        if (tinfo.dates && c.classStart) {
          const use = tinfo.dates.filter((d) => d >= todayYmd);
          const ds = use.length ? use : tinfo.dates;
          disp.classStart = `${ds[0]}T${timePart(c.classStart)}`;
          disp.classEnd = `${ds[ds.length - 1]}T${timePart(c.classEnd ?? c.classStart)}`;
        }
        if (tinfo.dates?.length > 1) {
          const upcoming = tinfo.dates.filter((d) => d >= todayYmd);
          disp.datesList = upcoming.length ? upcoming : tinfo.dates;
        }
        if (tinfo.weekdays && !disp.recurrence) {
          const names = tinfo.weekdays.map((d) => DAYCH[d]).join('·');
          disp.recurrence = tinfo.weekdays.length === 1 ? `${names}요일` : names;
        }
        if (note?.time) disp = applyTime(disp, note.time); // 내가 고친 시간
        // 갈 수 없는 시간과 겹치는지 (상시 운영 시설은 "운영 시간"일 뿐이라 따지지 않음)
        const isStandingRow = editDays ? false : isStanding(c, tinfo);
        const timeRange = disp.timeKnown && disp.classStart && fmtTime(disp.classStart) !== '00:00'
          ? { start: fmtTime(disp.classStart), end: fmtTime(disp.classEnd ?? disp.classStart) }
          : null;
        const busyState = isStandingRow ? 'ok' : classifyBusy({ busy: busyList, slots: disp.timeSlots ?? null, range: timeRange, daySet });
        if (editDays) disp.recurrence = daysLabel(note.days, note.weeks);
        if (!myDates && c.detailClosed?.length) {
          const upcoming = c.detailClosed.filter((d) => d >= todayYmd);
          if (upcoming.length) disp.closedList = upcoming;
        }
        const multiDay = c.classStart && c.classEnd && c.classStart.slice(0, 10) !== c.classEnd.slice(0, 10);
        // 달력으로 이동할 때 쓸 첫 날짜 (카드의 날짜를 누르면 이 날로)
        const focusYmd = occurrenceDates(disp, daySet, todayYmd, tinfo).dates[0] ?? (c.classStart ? c.classStart.slice(0, 10) : null);
        return {
          orig: c,
          note,
          dateSource,
          focusYmd,
          imageSchedule: !!(c.detailHasImage && !tinfo.dates && !tinfo.weekdays && !(c.weekdays && c.weekdays.length)),
          course: disp,
          status,
          kidMatches: kidMatchesF,
          autoKidMatches,
          edits: editLabels(note),
          targetNote,
          audience,
          tinfo,
          daySet,
          online,
          standing: isStandingRow, // 요일을 직접 고친 건 상시 시설로 보지 않음
          busy: busyState,
          trust: dateTrust({ dateSource, tinfo, course: c, standing: isStandingRow }),
          placeKey: placeKeyOf(c),
          placeSt: placeState(places, placeKeyOf(c)),
          isNew: isNewId(seen, c.id, nowMs),
          needDetail: !daySet && !tinfo.dates && !!multiDay,
          groupKey: groupKeyOf(c),
          chip: chipLabel(c, tinfo),
          distance: online ? null : distanceKm(HOME, { lat: c.lat, lng: c.lng }),
        };
      }),
    [courses, kids, nowMs, activeIds, now, todayYmd, notes, busyList, places, seen, bothKids],
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

  // 카드의 날짜를 누르면: 폰은 달력 탭으로, PC는 오른쪽 달력에서 그 날짜를 보여줌
  const focusCalendar = (ymd) => {
    if (!ymd) return;
    setCalendarFocus({ ymd, n: Date.now() });
    if (!isDesktop) setView('calendar');
    else document.querySelector('.pane-cal')?.scrollTo?.({ top: 0 });
  };

  const hiddenKind = (e) =>
    hiddenSet.has(e.groupKey) ? 'group'
      : hiddenRoundSet.has(e.course.id) ? 'round'
        : e.busy === 'blocked' && !(favs.has(e.groupKey) || favs.has(e.course.id)) ? 'busy'
          : e.placeSt === 'hide' && !(favs.has(e.groupKey) || favs.has(e.course.id)) ? 'place'
            : null;
  // 설정(갈 수 없는 시간·제외 장소)이 숨긴 것은 카드의 "되살리기" 버튼이 아니라 설정에서 풂
  const autoHidden = (e) => ['busy', 'place'].includes(hiddenKind(e));

  // "관심 없어요": 같은 프로그램(모든 회차)을 목록과 달력에서 숨김. 찜해 둔 것이면 찜도 풀림
  const hideItem = (members) => {
    const key = members[0].groupKey;
    const nextFavs = new Set(favs);
    members.forEach((m) => { nextFavs.delete(m.groupKey); nextFavs.delete(m.course.id); });
    setSettings({ ...settings, hidden: [...new Set([...(settings.hidden ?? []), key])], favs: [...nextFavs] });
    setToast({ kind: 'group', key, text: `숨겼어요 · ${members[0].course.title}` });
  };
  // 장소 이름을 눌러 정하는 관심(★)·제외(✕) 장소. state=null 이면 해제
  const applyPlace = (key, name, state) => {
    if (!key) return;
    const prev = placeState(places, key);
    setSettings({ ...settings, places: withPlace(places, key, name, state) });
    if (state === 'hide') setToast({ kind: 'place', key, name, prev, text: `이 장소를 제외했어요 · ${name}` });
  };
  const setPlaceFor = (row, state) => applyPlace(row.placeKey, placeName(row.course), state);
  // 장소 목록에서 이름을 누르면: 그 장소의 프로그램만 목록에 보여줌
  const pickPlace = (it) => {
    setPlaceFocus({ key: it.key, name: it.name });
    setPlacesOpen(false);
    setTab('all'); setView('list'); setFavOnly(false); setPlaceOnly(false); setShowHidden(false);
    window.scrollTo?.({ top: 0 });
  };
  const newShown = (e) => e.isNew && (e.placeSt === 'fav' || isFavRow(e)); // NEW 는 관심 장소·찜한 프로그램에만 붙임

  // "이 회차만 관심 없어요": 이 회차 하나만 숨기고 같은 프로그램의 다른 회차는 그대로 둠. 찜해 둔 회차면 찜도 풀림
  const hideRound = (row) => {
    const id = row.course.id;
    const nextFavs = (settings.favs ?? []).filter((f) => f !== id);
    setSettings({ ...settings, hiddenRounds: [...new Set([...(settings.hiddenRounds ?? []), id])], favs: nextFavs });
    setToast({ kind: 'rounds', ids: [id], text: `이 회차만 숨겼어요 · ${row.chip || row.course.title}` });
  };
  const roundsOf = (row) => enriched.filter((e) => e.groupKey === row.groupKey && !isOver(e) && !hiddenRoundSet.has(e.course.id));
  const unhide = (key) => setSettings((s) => ({ ...s, hidden: (s.hidden ?? []).filter((k) => k !== key) }));
  const unhideRounds = (ids) => setSettings((s) => ({ ...s, hiddenRounds: (s.hiddenRounds ?? []).filter((id) => !ids.includes(id)) }));

  // "이 회차만 남기기": 지금 고른 회차만 두고 같은 프로그램의 나머지 회차를 숨김
  const keepOnly = (row) => {
    const others = enriched
      .filter((e) => e.groupKey === row.groupKey && e.course.id !== row.course.id && !isOver(e) && !hiddenRoundSet.has(e.course.id))
      .map((e) => e.course.id);
    if (!others.length) return;
    setSettings((s) => ({ ...s, hiddenRounds: [...new Set([...(s.hiddenRounds ?? []), ...others])] }));
    setToast({ kind: 'rounds', ids: others, text: `${row.chip} 회차만 남기고 ${others.length}개를 숨겼어요` });
  };

  const saveNote = (id, note) =>
    setSettings((s) => {
      const n = { ...(s.notes ?? {}) };
      if (note) n[id] = note; else delete n[id];
      return { ...s, notes: n };
    });

  // 카드 맨 아래 버튼들: 보통은 숨기기, "숨긴 것 다시 보기"에서는 되살리기
  const actionsFor = (row, members) => {
    const hk = hiddenKind(row);
    if (showHidden && (hk === 'busy' || hk === 'place')) return []; // 설정의 "갈 수 없는 시간"·제외 장소로 숨겨진 것
    if (showHidden) {
      return hk === 'group'
        ? [{ label: '다시 보이게 하기', onClick: () => unhide(row.groupKey) }]
        : [{ label: '이 회차만 숨기기 취소', onClick: () => unhideRounds([row.course.id]) }];
    }
    const acts = [];
    if (members.length > 1) {
      acts.push({ label: '이 회차만 관심 없어요', onClick: () => hideRound(row) });
      acts.push({ label: '이 회차만 남기기', onClick: () => keepOnly(row) });
      acts.push({ label: '프로그램 전체 관심 없어요', onClick: () => hideItem(members) });
    } else {
      acts.push({ label: '관심 없어요 (숨기기)', onClick: () => hideItem(members) });
    }
    return acts;
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
      const hk = hiddenKind(e);
      if (showHidden) return !!hk; // 숨긴 것만 보여줌(다시 보이게 하려고)
      if (hk && !(placeFocus && hk === 'place')) return false; // 제외 장소를 직접 열어 본 경우는 보여줌
      if (favOnly) return isFavRow(e); // 찜 목록은 구·대상·분야 조건과 상관없이 보여줌
      if (placeOnly && e.placeSt !== 'fav') return false; // 관심 장소만 (구 선택과 상관없이, 대상 조건은 적용)
      if (placeFocus && e.placeKey !== placeFocus.key) return false; // 장소 목록에서 고른 장소만
      if (scope === 'near' && !placeOnly && !placeFocus && c.area && !settings.areas.includes(c.area)) return false;
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
    return e.status === 'open' || e.status === 'upcoming' || showClosed || favOnly || showHidden;
  };
  // 요일 칩을 골랐는데 요일을 알 수 없는 프로그램은 "요일 확인 필요"로 따로 접어 둠
  const isDayUnknown = (e) => effDays.length > 0 && !e.daySet;
  // 묶음 기준 개수 (상시 운영·요일 확인 필요는 따로 세므로 뺌)
  const countItems = (rows) => new Set(rows.filter((e) => !e.standing && !isDayUnknown(e)).map((e) => e.groupKey)).size;

  const dep = [scope, placeOnly, placeFocus, settings.areas, showAllTargets, includeOpen, freeOnly, q, favOnly, favs, hiddenSet, hiddenRoundSet, showHidden, activeIds, effDays, todayYmd];
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
  }, [base, showClosed, favOnly, showHidden]);
  const catCounts = useMemo(() => {
    const per = {};
    baseNoCats.filter((e) => inTab(e, tab) && !e.standing && !isDayUnknown(e)).forEach((e) => (e.course.tags ?? []).forEach((t) => { (per[t] ??= new Set()).add(e.groupKey); }));
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.size]));
  }, [baseNoCats, tab, showClosed, favOnly, showHidden]);

  // 정렬한 회차 목록 (달력은 이 목록을 회차 하나하나로 씀)
  const list = useMemo(() => {
    const rows = base.filter((e) => inTab(e, tab));
    const nextAction = (e) => (e.status === 'open' ? ms(e.course.applyEnd) : e.status === 'upcoming' ? ms(e.course.applyStart) : Infinity);
    const key = sort === 'use' ? (e) => Math.max(ms(e.course.classStart), nowMs) : nextAction;
    return [...rows].sort((a, b) => key(a) - key(b) || ms(a.course.classStart) - ms(b.course.classStart));
  }, [base, tab, sort, showClosed, favOnly, showHidden]);

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

  // 상시 운영(한 달 내내 열려 있는 시설 예약)은 따로 모아 맨 아래 섹션으로
  const itemStanding = (it) => it.members.every((m) => m.standing);
  const itemDayUnknown = (it) => it.members.every((m) => isDayUnknown(m));
  const mainItems = useMemo(() => items.filter((it) => !itemStanding(it) && !itemDayUnknown(it)), [items, effDays]);
  const unknownItems = useMemo(() => items.filter((it) => !itemStanding(it) && itemDayUnknown(it)), [items, effDays]);
  const standingItems = useMemo(() => items.filter(itemStanding), [items]);

  // 접수예정 탭: 접수가 열리는 날짜별로 묶어서, 가장 빨리 열리는 것부터 (인기 프로그램은 미리 알람을 맞춰 두려고)
  const upcomingGroups = useMemo(() => {
    if (tab !== 'upcoming') return null;
    const startOf = (it) => Math.min(...it.members.filter((m) => m.status === 'upcoming').map((m) => ms(m.course.applyStart)));
    const tomorrow = toYmd(new Date(nowMs + 86400000));
    const map = new Map();
    [...mainItems].sort((a, b) => startOf(a) - startOf(b)).forEach((it) => {
      const t = startOf(it);
      const ymd = Number.isFinite(t) ? toYmd(new Date(t)) : '';
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd).push(it);
    });
    return [...map.entries()].map(([ymd, its]) => ({
      ymd,
      items: its,
      label: !ymd ? '접수 일정 미정' : `${ymd === todayYmd ? '오늘 · ' : ymd === tomorrow ? '내일 · ' : ''}${fmtDate(`${ymd}T12:00:00+09:00`)} 접수 시작`,
    }));
  }, [mainItems, tab, nowMs, todayYmd]);

  // "가까운 구 순": 구별로 묶고, 집에서 가까운 구부터
  const areaBuckets = useMemo(() => {
    if (sort !== 'area') return null;
    const m = new Map();
    mainItems.forEach((it) => {
      const a = it.members[0].course.area || '';
      if (!m.has(a)) m.set(a, []);
      m.get(a).push(it);
    });
    return [...m.entries()]
      .sort(([a], [b]) => compareAreas(a, b))
      .map(([area, its]) => ({ area, items: its }));
  }, [mainItems, sort]);

  const hiddenCount = useMemo(
    () => new Set(enriched.filter((e) => !isOver(e) && hiddenKind(e)).map((e) => e.groupKey)).size,
    [enriched, hiddenSet, hiddenRoundSet, todayYmd],
  );
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

  // 장소 페이지에 보여줄 회차: 지금 목록 조건(구·대상·접수상태)과 같되, 장소·요일 같은 세부 조건은 뺌
  const placeRows = useMemo(
    () => enriched.filter((e) => {
      if (isOver(e) || hiddenSet.has(e.groupKey) || hiddenRoundSet.has(e.course.id) || e.busy === 'blocked') return false;
      if (!showAllTargets && (e.audience.kind === 'no' || (e.audience.kind === 'open' && !includeOpen))) return false;
      if (!(e.status === 'open' || e.status === 'upcoming' || showClosed)) return false;
      return !(scope === 'near' && e.course.area && !settings.areas.includes(e.course.area));
    }), // eslint-disable-line react-hooks/exhaustive-deps
    [enriched, hiddenSet, hiddenRoundSet, showAllTargets, includeOpen, showClosed, scope, settings.areas, todayYmd],
  );

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
      standing={e.standing}
      dateSource={e.dateSource}
      focusYmd={e.focusYmd}
      imageSchedule={e.imageSchedule}
      edits={e.edits}
      onGoCalendar={focusCalendar}
      actions={actionsFor(e, [e])}
      note={e.note}
      onNote={() => setNoteFor(e.course.id)}
      placeSt={e.placeSt}
      onPlace={(st) => setPlaceFor(e, st)}
      isNew={newShown(e)}
      trust={e.trust}
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
        getActions={(sel) => actionsFor(sel, it.members)}
        onNote={setNoteFor}
        onGoCalendar={focusCalendar}
        onPlace={setPlaceFor}
        newOf={newShown}
      />
    ) : (
      renderCard(it.members[0])
    );

  const renderCompact = (e) => {
    const c = e.course;
    const time = fmtStartTime(c);
    return (
      <div key={c.id} className="cal-row-wrap">
        <a className={`cal-row ${e.status}${e.trust?.level === 'guess' ? ' guess' : ''}`} href={c.url} target="_blank" rel="noopener noreferrer">
          <span className={`badge ${e.status === 'open' ? 'open' : e.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
            {STATUS_LABEL[e.status]}
          </span>
          <span className="cal-row-title">{c.title}</span>
          <span className="cal-row-sub">{time && `${time} · `}{c.place}</span>
          {e.note && (e.note.text || e.note.dates?.length > 0) && (
            <span className="cal-row-note">
              📝 {e.note.text}{e.note.dates?.length > 0 && ` ${e.note.text ? '· ' : ''}내 일정 ${e.note.dates.map(fmtMyDate).join(', ')}`}
            </span>
          )}
          <span className="cal-row-target">
            대상 {c.targetText || '원문 없음'}
            <KidPills kidMatches={e.kidMatches} />
            {e.audience.kind === 'no' && e.audience.reason && (
              <span className="pill bad">{REASON_LABEL[e.audience.reason]}</span>
            )}
          </span>
        </a>
        {/* 링크 바깥에 둔 버튼들: 눌러도 예약 사이트로 넘어가지 않아요 */}
        <button type="button" className="cal-note" aria-label="메모 · 내 날짜" title="메모 · 내 날짜" onClick={() => setNoteFor(c.id)}>
          {e.note ? '📝' : '✎'}
        </button>
        <button
          type="button"
          className="cal-hide"
          aria-label={showHidden ? '다시 보이게 하기' : '관심 없어요 (숨기기)'}
          title={showHidden ? '다시 보이게 하기' : '관심 없어요 · 이 회차만 숨겨요 (프로그램 전체는 카드 아래 버튼)'}
          disabled={showHidden && autoHidden(e)}
          onClick={() => (showHidden ? (hiddenKind(e) === 'group' ? unhide(e.groupKey) : unhideRounds([e.course.id])) : roundsOf(e).length > 1 ? hideRound(e) : hideItem([e]))}
        >
          {showHidden ? '↺' : '✕'}
        </button>
      </div>
    );
  };

  const hasErrors = meta.errors?.length > 0;

  // ---- 필터 부품: 폰과 PC가 같은 부품을 다른 배치로 씀 ----
  // 최근·고정 검색어: 엔터를 치거나 검색창을 벗어날 때 저장(두 글자 이상). 글자를 칠 때마다 저장하지는 않음
  const saveSearches = (next) => {
    if (JSON.stringify(next) !== JSON.stringify(searches)) setSettings({ ...settings, searches: next });
  };
  const commitSearch = (t) => saveSearches(addRecent(searches, t));
  const searchTerms = [...searches.pinned.map((t) => ({ t, pin: true })), ...searches.recent.map((t) => ({ t, pin: false }))];
  const searchEl = (
    <div className="searchbox">
      <input
        type="search"
        className="search"
        placeholder={isDesktop ? '프로그램명·장소 검색' : '프로그램·장소 검색'}
        aria-label="프로그램명·장소 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => { commitSearch(query); setTimeout(() => setSearchFocus(false), 200); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { commitSearch(query); e.currentTarget.blur(); } }}
      />
      {searchFocus && searchTerms.length > 0 && (
        <div className="search-drop" role="listbox" aria-label="최근·고정 검색어" onMouseDown={(e) => e.preventDefault()}>
          {searchTerms.map(({ t, pin }) => (
            <span key={`${pin ? 'p' : 'r'}:${t}`} className={`sterm${pin ? ' pin' : ''}`}>
              <button type="button" className="sterm-t" onClick={() => { setQuery(t); saveSearches(addRecent(searches, t)); setSearchFocus(false); }}>{t}</button>
              <button type="button" className="sterm-b" aria-label={pin ? `${t} 고정 해제` : `${t} 고정`} title={pin ? '고정 해제' : '고정'} onClick={() => saveSearches(togglePin(searches, t))}>{pin ? '📌' : '📍'}</button>
              <button type="button" className="sterm-b" aria-label={`${t} 지우기`} onClick={() => saveSearches(removeTerm(searches, t))}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
  const favBtn = (
    <button
      type="button"
      className={`fav-toggle${favOnly ? ' on' : ''}`}
      aria-pressed={favOnly}
      aria-label={`찜 ${favCount}개만 보기`}
      title="찜한 프로그램만 보기"
      onClick={() => setFavOnly((v) => !v)}
    >
      {favOnly ? '♥' : '♡'}{isDesktop ? ' 찜 ' : ' '}{favCount}
    </button>
  );
  const placeBtn = favPlaces.length > 0 || placeOnly ? (
    <button
      type="button"
      className={`fav-toggle place${placeOnly ? ' on' : ''}`}
      aria-pressed={placeOnly}
      aria-label={`관심 장소 ${favPlaces.length}곳의 프로그램만 보기`}
      title="관심 장소(★)의 프로그램만 보기"
      onClick={() => setPlaceOnly((v) => !v)}
    >
      {placeOnly ? '★' : '☆'} {isDesktop ? '관심 장소 ' : ''}{favPlaces.length}
    </button>
  ) : null;
  const tabsEl = (
    <div className="tabs" role="tablist">
      {TABS.map((x) => (
        <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
          {x.label} <span className="n">{tabCounts[x.id]}</span>
        </button>
      ))}
    </div>
  );
  const catsEl = (
    <div className="cats" role="group" aria-label="분야">
      <button type="button" className={`chip all${cats.length === 0 ? ' on' : ''}`} aria-pressed={cats.length === 0} onClick={() => setCats([])}>전체</button>
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
    </div>
  );
  const bothEl = activeIds.length > 1 ? (
    <label className="both-kids">
      <input type="checkbox" checked={bothKids} onChange={() => setSettings({ ...settings, bothKids: !bothKids })} /> 둘 다 갈 수 있는 것만
    </label>
  ) : null;
  const kidsEl = (
    <div className="kids" role="group" aria-label="아이">
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
      {bothEl}
    </div>
  );
  const placesBtn = (
    <button type="button" className={`fbtn${placeFocus ? ' on' : ''}`} onClick={() => setPlacesOpen(true)}>📍 장소 목록</button>
  );
  const scopeSeg = (
    <div className="seg" role="group" aria-label="지역">
      <button className={scope === 'near' ? 'on' : ''} onClick={() => setScope('near')}>선택한 구</button>
      <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>서울 전체</button>
    </div>
  );
  const sortEl = (
    <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
      {SORTS.map((x) => (<option key={x.id} value={x.id}>{x.label}</option>))}
    </select>
  );
  const hintEl =
    scope === 'near' && !favOnly ? (
      <p className="scope-hint">
        <span className="scope-areas">{settings.areas.length ? settings.areas.join(' · ') : '선택된 구가 없어요'}</span>
        <button type="button" className="link-btn" onClick={() => setSettingsOpen(true)}>구 바꾸기</button>
      </p>
    ) : null;
  // 요일: "전체"를 알약으로 앞에 두고, 아무것도 안 골랐거나 7개를 다 고른 상태는 "전체"로 보여줌(요일 버튼은 연하게)
  const pickDay = (d) =>
    setSettings({ ...settings, days: allDays ? [d] : days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  const daysEl = !phoneCalendar ? (
    <div className={`days${allDays ? ' all' : ''}`} role="group" aria-label="이용 요일">
      <button type="button" className={`day-all${allDays ? ' on' : ''}`} aria-pressed={allDays} onClick={() => setSettings({ ...settings, days: [] })}>전체</button>
      {DAY_ORDER.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={!allDays && days.includes(d)}
          className={`day${!allDays && days.includes(d) ? ' on' : ''}${d === 0 ? ' sun' : d === 6 ? ' sat' : ''}`}
          onClick={() => pickDay(d)}
        >
          {DAY_LABELS[d]}
        </button>
      ))}
    </div>
  ) : null;
  // 필터를 접었을 때 보여주는 한 줄 요약: 기본값이 아닌 것만 진하게
  const sumItems = [
    { k: 'cats', on: cats.length > 0, text: cats.length ? cats.map((id) => CATEGORIES.find((c) => c.id === id)?.label).filter(Boolean).join('·') : '분야 전체' },
    { k: 'kids', on: activeIds.length !== kids.length || (bothKids && activeIds.length > 1), text: `${kids.filter((k) => activeIds.includes(k.id)).map((k) => k.label).join('·') || '아이 없음'}${bothKids && activeIds.length > 1 ? ' (둘 다)' : ''}` },
    { k: 'area', on: scope === 'all', text: scope === 'near' ? (settings.areas.length > 1 ? `${settings.areas[0]} 외 ${settings.areas.length - 1}곳` : settings.areas[0] ?? '구 선택 없음') : '서울 전체' },
    { k: 'days', on: !allDays, text: allDays ? '요일 전체' : DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_LABELS[d]).join('·') },
  ];
  const checkLabels = (
    <>
      <label><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> 무료만 보기</label>
      <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> 예약마감·종료 포함</label>
      <label><input type="checkbox" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} /> 대상 "제한없음"도 포함{openHidden > 0 && !includeOpen ? ` (${openHidden})` : ''}</label>
      <label><input type="checkbox" checked={showAllTargets} onChange={(e) => setShowAllTargets(e.target.checked)} /> 대상 안 맞는 것 포함 (단체·장애인 등)</label>
      {(hiddenCount > 0 || showHidden) && (
        <label><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 숨긴 것만 보기 ({hiddenCount})</label>
      )}
    </>
  );
  // PC: 체크박스들을 "옵션" 버튼 하나로 모음 (켜 둔 개수를 숫자로 보여줌)
  const optionCount = [freeOnly, showClosed, includeOpen, showAllTargets, showHidden].filter(Boolean).length;
  const optionsEl = (
    <div className="opt-wrap">
      <button
        type="button"
        className={`opt-btn${optionsOpen || optionCount > 0 ? ' on' : ''}`}
        aria-expanded={optionsOpen}
        onClick={() => setOptionsOpen((v) => !v)}
      >
        옵션 ▾{optionCount > 0 && <span className="opt-n">{optionCount}</span>}
      </button>
      {optionsOpen && (
        <>
          <div className="pop-backdrop" onClick={() => setOptionsOpen(false)} />
          <div className="opt-pop" role="dialog" aria-label="옵션">{checkLabels}</div>
        </>
      )}
    </div>
  );

  // ---- 폰: 분야·아이·구·옵션 버튼 4개 + 아래에서 올라오는 선택 창 ----
  const phoneOptionCount = optionCount + (!allDays ? 1 : 0) + (sort !== 'apply' ? 1 : 0);
  const daysText = DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_LABELS[d]).join('·');
  const fbtn = (label, badge, on, onClick) => (
    <button type="button" className={`fbtn${on ? ' on' : ''}`} onClick={onClick}>
      {label}{badge ? <span className="opt-n">{badge}</span> : ' ▾'}
    </button>
  );
  const phoneBar = (
    <>
      <div className="fbar">
        {fbtn('분야', cats.length || null, cats.length > 0, () => setSheet('cats'))}
        {fbtn(activeIds.length === kids.length ? '아이' : `아이 ${activeIds.length}/${kids.length}`, null, activeIds.length !== kids.length || (bothKids && activeIds.length > 1), () => setSheet('kids'))}
        {fbtn(scope === 'near' ? '구' : '서울', scope === 'near' ? settings.areas.length : null, scope === 'all', () => setSheet('area'))}
        {fbtn('옵션', phoneOptionCount || null, phoneOptionCount > 0, () => setSheet('options'))}
      </div>
      {(cats.length > 0 || !allDays) && (
        <div className="ftags">
          {cats.map((id) => (
            <button key={id} type="button" className="ftag" onClick={() => toggleCat(id)}>
              {CAT_BY_ID[id].emoji} {CAT_BY_ID[id].label} ✕
            </button>
          ))}
          {!allDays && (
            <button type="button" className="ftag" onClick={() => setSettings({ ...settings, days: [] })}>요일 {daysText} ✕</button>
          )}
        </div>
      )}
    </>
  );
  const closeSheet = () => setSheet(null);
  const phoneSheets = (
    <>
      {sheet === 'cats' && (
        <Sheet
          title="분야"
          onClose={closeSheet}
          footer={
            <div className="note-actions">
              <button className="primary" onClick={closeSheet}>완료</button>
              {cats.length > 0 && <button className="outline" onClick={() => setCats([])}>전체 해제</button>}
            </div>
          }
        >
          <div className="fs-grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} className={`fs-btn${cats.includes(c.id) ? ' on' : ''}`} onClick={() => toggleCat(c.id)}>
                <span aria-hidden>{c.emoji}</span> {c.label} <small>{catCounts[c.id] ?? 0}</small>
              </button>
            ))}
          </div>
          <p className="hint">고르지 않으면 모든 분야가 보여요. 여러 개를 고를 수 있어요.</p>
        </Sheet>
      )}
      {sheet === 'kids' && (
        <Sheet title="아이" onClose={closeSheet}>
          <div className="fs-grid one">
            {kids.map((k) => (
              <button key={k.id} type="button" aria-pressed={activeIds.includes(k.id)} className={`fs-btn${activeIds.includes(k.id) ? ' on' : ''}`} onClick={() => toggleKid(k.id)}>
                {k.label} · {gradeLabel(gradeOn(k.birthYear, now))}
              </button>
            ))}
          </div>
          {bothEl}
          <p className="hint">고른 아이에게 맞는 프로그램만 보여요. 아이를 둘 이상 고르면 &quot;둘 다 갈 수 있는 것만&quot;을 켤 수 있어요. 아이 정보는 설정에서 바꿔요.</p>
        </Sheet>
      )}
      {sheet === 'area' && (
        <Sheet title="구 선택" onClose={closeSheet}>
          {scopeSeg}
          {scope === 'near' ? (
            <AreaPicker settings={settings} setSettings={setSettings} />
          ) : (
            <p className="hint">서울 전체의 프로그램을 보여줘요.</p>
          )}
        </Sheet>
      )}
      {sheet === 'options' && (
        <Sheet title="옵션" onClose={closeSheet}>
          <fieldset className="sheet-sort">
            <legend>정렬</legend>
            {SORTS.map((x) => (
              <label key={x.id}><input type="radio" name="sort" checked={sort === x.id} onChange={() => setSort(x.id)} /> {x.label}</label>
            ))}
          </fieldset>
          <div className="sheet-days">
            <div className="days" role="group" aria-label="이용 요일">
              <span className="days-label">요일</span>
              {DAY_ORDER.map((d) => (
                <button key={d} type="button" aria-pressed={days.includes(d)} className={`day${days.includes(d) ? ' on' : ''}${d === 0 ? ' sun' : d === 6 ? ' sat' : ''}`} onClick={() => toggleDay(d)}>
                  {DAY_LABELS[d]}
                </button>
              ))}
              {!allDays && <button type="button" className="link-btn" onClick={() => setSettings({ ...settings, days: [] })}>전체</button>}
            </div>
            {phoneCalendar && <p className="hint">달력 화면에서는 요일 필터가 적용되지 않아요. 목록에서 적용돼요.</p>}
          </div>
          <div className="sheet-checks">{checkLabels}</div>
        </Sheet>
      )}
    </>
  );

  const noteRow = noteFor ? enriched.find((e) => e.course.id === noteFor) : null;

  return (
    <div className="app">
      <header className="top">
        <AppSwitcher current="kids" title="서울 아이 체험" sub="숲체험 · 박물관 · 어린이 체험 예약을 한곳에서" />
        <div className="top-right">
          {isDesktop && !meta.isSample && meta.fetchedAt && (
            <span className="stamp">마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)}<br />수집된 프로그램 {courses.length}건</span>
          )}
          <button className="grade-chip" onClick={() => setSettingsOpen(true)} aria-label="설정">
            설정{sync.user ? ' ☁' : ''}
          </button>
        </div>
      </header>

      {noticeOpen && (
        <div className="notice" role="note">
          <span>ⓘ 접수 상태는 서울시 공개 데이터 기준이라 실제와 다를 수 있어요. 신청 전에 서울시 사이트에서 확인하세요.</span>
          <button type="button" aria-label="공지 닫기" onClick={dismissNotice}>✕</button>
        </div>
      )}

      {!loading && meta.isSample && (
        <div className="banner">
          지금 보이는 건 <strong>화면 확인용 샘플</strong>이에요(서울시 예약 사이트의 실제 프로그램 10건).
          인증키를 연결하면 전체 목록이 나와요.
        </div>
      )}
      {hasErrors && (
        <div className="banner err">
          일부 정보를 가져오지 못했어요: {meta.errors.map((e) => `${e.source}${e.message ? ` (${e.message})` : ''}`).join(', ')}.
          목록에 빠진 프로그램이 있을 수 있어요.
        </div>
      )}

      {isDesktop ? (
        <nav className="filters toolbar tb2" aria-label="필터">
          <div className="tb-row">
            {searchEl}
            <div className="quick" role="group" aria-label="바로가기">{favBtn}{placeBtn}{placesBtn}</div>
            {optionsEl}
          </div>
          <div className="tb-row tb-status">
            {tabsEl}
            <div className="tb-right">
              <label className="sort-lbl"><span>정렬</span>{sortEl}</label>
              <button type="button" className="fold-btn" aria-expanded={filtersOpen} onClick={toggleFilters}>필터 {filtersOpen ? '접기 ▴' : '펼치기 ▾'}</button>
            </div>
          </div>
          {filtersOpen ? (
            <div className="tb-grid">
              <div className="fgroup wide"><span className="flabel">분야</span>{catsEl}</div>
              <div className="fgroup"><span className="flabel">아이</span>{kidsEl}</div>
              <div className="fgroup"><span className="flabel">요일</span>{daysEl}</div>
              <div className="fgroup wide"><span className="flabel">지역</span>{scopeSeg}{hintEl}</div>
            </div>
          ) : (
            <button type="button" className="tb-summary" onClick={toggleFilters} aria-label="필터 펼치기">
              {sumItems.map((x) => (<span key={x.k} className={`sum-pill${x.on ? ' on' : ''}`}>{x.text}</span>))}
            </button>
          )}
        </nav>
      ) : (
        <nav className="filters" aria-label="필터">
          <div className="searchrow">{searchEl}{favBtn}{placeBtn}</div>
          {tabsEl}
          {phoneBar}
        </nav>
      )}

      {placeFocus && (
        <div className="focus-bar" role="status">
          <span>📍 <strong>{placeFocus.name}</strong>만 보는 중</span>
          <button type="button" className="link-btn" onClick={() => setPlaceFocus(null)}>✕ 해제</button>
        </div>
      )}

      <main className="panes">
        <section className="pane-list" hidden={!isDesktop && view !== 'list'}>
          {items.length === 0 ? (
            <div className="empty">
              <h3>조건에 맞는 프로그램이 없어요</h3>
              <p>
                수집된 {courses.length}건 중 지금 조건에 맞는 게 없어요.
                {showHidden && ' 숨긴 프로그램이 없어요.'}
                {favOnly && ' 찜한 프로그램이 없거나 검색어에 맞는 게 없어요.'}
                {scope === 'near' && !favOnly && ' "서울 전체"로 바꿔 보세요.'}
                {!includeOpen && openHidden > 0 && ` 대상이 "제한없음"인 ${openHidden}건은 숨겨져 있어요.`}
                {q && ' 검색어를 지워 보세요.'}
              </p>
            </div>
          ) : (
            <>
              {(unknownItems.length > 0 || standingItems.length > 0) && (
                <p className="fold-hint">
                  접혀 있는 항목:
                  {unknownItems.length > 0 && (
                    <button type="button" className="fold-btn" onClick={() => openFold(unknownRef)}>요일 확인 필요 {unknownItems.length}개</button>
                  )}
                  {standingItems.length > 0 && (
                    <button type="button" className="fold-btn" onClick={() => openFold(standingRef)}>상시 운영 {standingItems.length}개</button>
                  )}
                </p>
              )}
              {mainItems.length === 0 && (unknownItems.length > 0 || standingItems.length > 0) && (
                <p className="hint">
                  {unknownItems.length > 0 ? '고른 요일이 확인된 프로그램은 없어요. 요일을 알 수 없는 프로그램은 아래에 접혀 있어요.' : '날짜가 정해진 프로그램은 없고, 상시 운영만 있어요.'}
                </p>
              )}
              {upcomingGroups
                ? upcomingGroups.map((g) => (
                    <section key={g.ymd || 'none'} className="up-group">
                      <h3 className="up-head">{g.label} <small>{g.items.length}</small></h3>
                      {g.items.map(renderItem)}
                    </section>
                  ))
                : areaBuckets
                ? areaBuckets.map((b) => (
                    <AreaGroup key={b.area || 'none'} area={b.area} count={b.items.length} collapsed={collapsedAreas.has(b.area)} onToggle={toggleAreaCollapse}>
                      {b.items.map(renderItem)}
                    </AreaGroup>
                  ))
                : mainItems.map(renderItem)}
              {unknownItems.length > 0 && (
                <details className="standing" ref={unknownRef}>
                  <summary>요일 확인 필요 {unknownItems.length}개 · 눌러서 펼치기</summary>
                  <div className="area-items">{unknownItems.map(renderItem)}</div>
                </details>
              )}
              {standingItems.length > 0 && (
                <details className="standing" ref={standingRef}>
                  <summary>상시 운영 {standingItems.length}개 · 눌러서 펼치기</summary>
                  <div className="area-items">{standingItems.map(renderItem)}</div>
                </details>
              )}
            </>
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
              <CalendarView rows={list} renderItem={renderCompact} compact groupByArea={sort === 'area'} collapsed={collapsedAreas} onToggleArea={toggleAreaCollapse} focusDate={calendarFocus} />
            </section>
          </div>
        ) : (
          view === 'calendar' && (
            <section className="pane-cal-m" aria-label="달력">
              <CalendarView rows={list} renderItem={renderCard} groupByArea={sort === 'area'} collapsed={collapsedAreas} onToggleArea={toggleAreaCollapse} focusDate={calendarFocus} />
            </section>
          )
        )}
      </main>

      {!isDesktop && !meta.isSample && meta.fetchedAt && (
        <p className="foot data-stamp">마지막 업데이트 {fmtFetchedAt(meta.fetchedAt)} · 수집된 프로그램 {courses.length}건</p>
      )}

      {!isDesktop && (
        <div className="viewbar">
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>달력</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>목록</button>
          <button className={placesOpen || placeFocus ? 'on' : ''} onClick={() => setPlacesOpen(true)}>장소</button>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span className="toast-text">{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              if (toast.kind === 'group') unhide(toast.key);
              else if (toast.kind === 'place') setSettings((cur) => ({ ...cur, places: withPlace(cleanPlaces(cur.places), toast.key, toast.name, toast.prev) }));
              else unhideRounds(toast.ids);
              setToast(null);
            }}
          >되돌리기</button>
        </div>
      )}

      {!isDesktop && phoneSheets}

      {noteRow && (
        <NoteSheet key={noteRow.course.id} orig={noteRow.orig} note={noteRow.note} kids={kids} autoKidMatches={noteRow.autoKidMatches} onSave={(n) => saveNote(noteRow.course.id, n)} onClose={() => setNoteFor(null)} />
      )}

      {placesOpen && (
        <PlacesPage
          rows={placeRows}
          places={places}
          scopeLabel={scope === 'near' ? `선택한 구(${settings.areas.length}곳)` : '서울 전체'}
          onPick={pickPlace}
          onSetPlace={(it, st) => applyPlace(it.key, it.name, st)}
          onClose={() => setPlacesOpen(false)}
        />
      )}

      {settingsOpen && <Settings settings={settings} setSettings={setSettings} now={now} sync={sync} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
