import { useMemo, useState } from 'react';
import { monthGrid, toYmd } from '../lib/calendar';
import { fmtMyDate, parseMyDates } from '../lib/mydates';
import { fmtTime } from '../lib/format';
import { gradeLabel } from '../lib/grade';
import { cleanNote, noteSlots } from '../lib/edits';
import Sheet from './Sheet';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const RESULT_TEXT = { match: '해당', nomatch: '해당 아님', check: '확인 필요' };

// 새 시간대의 기본값은 오후(오전에는 거의 안 가는 쓰임새): 처음엔 오후 2시~3시 반, 그다음은 앞 시간대가 끝난 시각부터
const PM_START = '14:00';
const PM_END = '15:30';
const addMin = (hm, n) => {
  const t = Math.min(+hm.slice(0, 2) * 60 + +hm.slice(3, 5) + n, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const nextSlot = (slots) => {
  const last = slots[slots.length - 1];
  if (!last) return { start: PM_START, end: PM_END };
  const start = last.end || addMin(last.start, 60);
  return { start, end: addMin(start, 90) };
};

/**
 * 회차(예약 하나)의 "정보 고치기"와 메모.
 *  - 대상: 아이별로 자동 / 해당 / 해당 안 됨 (앱이 읽은 문구를 같이 보여줘서 확인하고 고침)
 *  - 날짜: "갈 수 있는 날만 체크" — 자동으로 읽은 날짜가 체크된 채로 나오고, 안 되는 날은 해제, 빠진 날은 달력에서 추가
 *  - 요일(+몇째 주), 시간(하루 여러 회차면 시간대를 여러 개)
 *  - 메모
 * 고친 값은 항상 자동 판정보다 우선하고, 비우거나 되돌리면 자동값을 써요.
 * orig 는 서울시 원본, autoKidMatches 는 고치기 전의 자동 판정, autoDates 는 자동으로 읽은 날짜 후보(없으면 null)
 */
export default function NoteSheet({ orig, note, kids, autoKidMatches, autoDates = null, targetInfo = {}, groupCount = 1, onSave, onClose }) {
  const win = { s: orig.classStart?.slice(0, 10) ?? null, e: orig.classEnd?.slice(0, 10) ?? null };
  const today = toYmd(new Date());
  const [text, setText] = useState(note?.text ?? '');
  const [fit, setFit] = useState(note?.fit ?? {});
  const [groupFit, setGroupFit] = useState(false);
  const [slots, setSlots] = useState(() => noteSlots(note).map((s) => ({ start: s.start, end: s.end ?? '' })));
  const [days, setDays] = useState(note?.days ?? []);
  const [weeks, setWeeks] = useState(note?.weeks ?? []);
  // 처음 열면: 내가 고른 날짜가 있으면 그것, 없으면 자동 날짜를 전부 체크한 상태로 시작
  const [dates, setDates] = useState(() => [...(note?.dates?.length ? note.dates : autoDates ?? [])].sort());
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const first = dates[0] ?? (win.s && win.s > today ? win.s : today);
  const [cursor, setCursor] = useState({ y: +first.slice(0, 4), m: +first.slice(5, 7) });
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const autoTime = (() => {
    if (orig.timeSlots?.length > 1) return orig.timeSlots.map((s) => `${s.start}–${s.end}`).join(' · ');
    if (orig.timeKnown && orig.classStart && fmtTime(orig.classStart) !== '00:00') {
      return `${fmtTime(orig.classStart)}${orig.classEnd && fmtTime(orig.classEnd) !== fmtTime(orig.classStart) ? `–${fmtTime(orig.classEnd)}` : ''}`;
    }
    return '시간 정보 없음';
  })();
  const autoDays = orig.recurrence || '요일 정보 없음';

  const outside = (ymd) => !!((win.s && ymd < win.s) || (win.e && ymd > win.e));
  const toggle = (ymd) => setDates((d) => (d.includes(ymd) ? d.filter((x) => x !== ymd) : [...d, ymd].sort()));
  const chipDates = useMemo(() => [...new Set([...(autoDates ?? []), ...dates])].sort(), [autoDates, dates]);
  const move = (delta) =>
    setCursor(({ y, m }) => {
      const n = y * 12 + (m - 1) + delta;
      return { y: Math.floor(n / 12), m: (n % 12) + 1 };
    });
  const setKidFit = (id, v) =>
    setFit((f) => {
      const n = { ...f };
      if (v) n[id] = v; else delete n[id];
      return n;
    });
  const toggleDay = (d) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const toggleWeek = (w) => setWeeks((x) => (x.includes(w) ? x.filter((y) => y !== w) : [...x, w]));

  const patchSlot = (i, p) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const addSlot = () => setSlots((s) => (s.length >= 6 ? s : [...s, nextSlot(s)]));
  const loadAutoSlots = () => {
    if (orig.timeSlots?.length > 1) setSlots(orig.timeSlots.map((s) => ({ start: s.start, end: s.end })));
    else if (orig.timeKnown && orig.classStart && fmtTime(orig.classStart) !== '00:00') {
      setSlots([{ start: fmtTime(orig.classStart), end: orig.classEnd && fmtTime(orig.classEnd) !== fmtTime(orig.classStart) ? fmtTime(orig.classEnd) : '' }]);
    }
  };
  const canLoadAuto = orig.timeSlots?.length > 1 || (orig.timeKnown && orig.classStart && fmtTime(orig.classStart) !== '00:00');

  const resetEdits = () => { setFit({}); setSlots([]); setDays([]); setWeeks([]); setDates([...(autoDates ?? [])]); };
  const sameAsAuto = !!autoDates && dates.length === autoDates.length && dates.every((d, i) => d === autoDates[i]);
  const anyEdit = Object.keys(fit).length > 0 || slots.length > 0 || days.length > 0 || (!!note?.dates?.length && !sameAsAuto);

  const addFromText = () => {
    const r = parseMyDates(input, orig);
    if (r.dates.length) {
      setDates((d) => [...new Set([...d, ...r.dates.map((x) => x.ymd)])].sort());
      const f = r.dates[0].ymd;
      setCursor({ y: +f.slice(0, 4), m: +f.slice(5, 7) });
    }
    const notes = [];
    if (r.bad) notes.push(`읽지 못한 부분: "${r.bad}". 예) 10/17, 10/24 또는 10/17~10/20`);
    if (r.dates.some((x) => x.outside)) notes.push('이용 기간 밖의 날짜가 있어요. 그래도 저장돼요.');
    setMsg(notes.join(' '));
    if (!r.bad) setInput('');
  };

  // 저장: 자동 날짜와 같으면 날짜는 저장하지 않음(자동값이 바뀌면 따라가게), 하나도 체크 안 했으면 자동값을 씀
  const build = () =>
    cleanNote({
      text,
      dates: sameAsAuto ? [] : dates,
      fit,
      slots: slots.filter((s) => s.start).map((s) => ({ start: s.start, end: s.end || null })),
      days,
      weeks,
    });
  const save = () => { onSave(build(), { groupFit }); onClose(); };

  const read = [
    targetInfo.targetText ? ['서울시 대상 칸', targetInfo.targetText] : null,
    targetInfo.titleTarget ? ['제목', targetInfo.titleTarget] : null,
    targetInfo.detailTarget ? ['상세내용', targetInfo.detailTarget] : null,
  ].filter(Boolean);

  return (
    <Sheet
      title="정보 고치기 · 메모"
      onClose={onClose}
      footer={
        <div className="note-actions">
          <button className="primary" onClick={save}>저장</button>
          {note && <button className="outline" onClick={() => { onSave(null, {}); onClose(); }}>모두 지우기</button>}
          <button className="outline" onClick={onClose}>닫기</button>
        </div>
      }
    >
      <p className="note-title">{orig.title}</p>

      <div className="note-section">
        <h3>대상 <small>자동으로 읽은 게 틀리면 고쳐요</small></h3>
        {read.length > 0 && (
          <ul className="read-list">
            {read.map(([k, v]) => (<li key={k}><b>{k}</b> {v}</li>))}
          </ul>
        )}
        {kids.map((k, i) => {
          const auto = autoKidMatches[i];
          const cur = fit[k.id] ?? '';
          return (
            <div className="fit-row" key={k.id}>
              <div className="fit-name">
                {k.label} <small>{auto ? gradeLabel(auto.grade) : ''}</small>
                <span className={`fit-auto ${auto?.match.result}`}>자동: {RESULT_TEXT[auto?.match.result] ?? '-'}</span>
              </div>
              <div className="seg3" role="group" aria-label={`${k.label} 대상`}>
                <button type="button" aria-pressed={cur === ''} className={cur === '' ? 'on' : ''} onClick={() => setKidFit(k.id, '')}>자동</button>
                <button type="button" aria-pressed={cur === 'yes'} className={cur === 'yes' ? 'on yes' : ''} onClick={() => setKidFit(k.id, 'yes')}>해당</button>
                <button type="button" aria-pressed={cur === 'no'} className={cur === 'no' ? 'on no' : ''} onClick={() => setKidFit(k.id, 'no')}>해당 안 됨</button>
              </div>
            </div>
          );
        })}
        {groupCount > 1 && (
          <label className="group-fit">
            <input type="checkbox" checked={groupFit} onChange={(e) => setGroupFit(e.target.checked)} /> 같은 프로그램의 다른 회차 {groupCount - 1}개에도 이 대상을 적용
          </label>
        )}
        <p className="hint">&quot;해당&quot;으로 고치면 단체·성인 대상·&quot;제한없음&quot;으로 자동으로 숨겼던 것도 보여줘요. &quot;해당 안 됨&quot;은 기본 목록에서 빠져요.</p>
      </div>

      <div className="note-section">
        <h3>갈 수 있는 날짜 <small>체크한 날만 달력에 보여요</small></h3>
        {win.s && (
          <p className="hint">서울시 이용 기간 {fmtMyDate(win.s)}{win.e && win.e !== win.s ? ` ~ ${fmtMyDate(win.e)}` : ''}</p>
        )}
        {autoDates ? (
          <>
            <div className="date-checks" role="group" aria-label="날짜 선택">
              {chipDates.map((d) => {
                const on = dates.includes(d);
                const extra = !autoDates.includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on} className={`dchip${on ? ' on' : ''}`} onClick={() => toggle(d)}>
                    {on ? '✓ ' : ''}{fmtMyDate(d)}{extra ? ' · 추가' : ''}{outside(d) ? ' (기간 밖)' : ''}
                  </button>
                );
              })}
            </div>
            <div className="date-tools">
              <button type="button" className="link-btn" onClick={() => setDates([...chipDates])}>모두 선택</button>
              <button type="button" className="link-btn" onClick={() => setDates([])}>모두 해제</button>
              {dates.length === 0 && <small className="hint">하나도 고르지 않으면 자동 날짜를 써요</small>}
            </div>
          </>
        ) : (
          <p className="hint">자동으로 읽은 날짜가 없어요(기간 중 운영 · 요일 확인). 갈 수 있는 날을 아래 달력에서 골라 주세요.</p>
        )}

        <details className="date-add" open={!autoDates}>
          <summary>{autoDates ? '다른 날짜 추가 (달력 · 글자로)' : '달력에서 고르기'}</summary>
          <div className="mc">
            <div className="mc-head">
              <button type="button" onClick={() => move(-1)} aria-label="이전 달">‹</button>
              <strong>{cursor.y}년 {cursor.m}월</strong>
              <button type="button" onClick={() => move(1)} aria-label="다음 달">›</button>
            </div>
            <div className="mc-grid mc-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="mc-grid">
              {cells.map((ymd, i) =>
                ymd ? (
                  <button
                    key={ymd}
                    type="button"
                    aria-pressed={dates.includes(ymd)}
                    className={`mc-day${dates.includes(ymd) ? ' sel' : ''}${!outside(ymd) ? ' in' : ''}${ymd === today ? ' today' : ''}`}
                    onClick={() => toggle(ymd)}
                  >
                    {+ymd.slice(8, 10)}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          </div>
          {!autoDates && dates.length > 0 && (
            <div className="mc-chips">
              {dates.map((d) => (
                <button key={d} type="button" className="gchip sel" onClick={() => toggle(d)} title="누르면 지워요">
                  {fmtMyDate(d)}{outside(d) ? ' (기간 밖)' : ''} ✕
                </button>
              ))}
            </div>
          )}
          <div className="mc-input">
            <input
              value={input}
              placeholder="글자로 쓰기: 10/17, 10/24 또는 10/17~10/20"
              aria-label="날짜를 글자로 입력"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFromText(); }}
            />
            <button type="button" className="outline" onClick={addFromText}>추가</button>
          </div>
          {msg && <p className="hint warn-text">{msg}</p>}
        </details>
      </div>

      <div className="note-section">
        <h3>요일 <small>자동: {autoDays}</small></h3>
        <div className="day-row" role="group" aria-label="요일">
          {DAY_ORDER.map((d) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} className={`day${days.includes(d) ? ' on' : ''}${d === 0 ? ' sun' : d === 6 ? ' sat' : ''}`} onClick={() => toggleDay(d)}>
              {DOW[d]}
            </button>
          ))}
          {days.length > 0 && <button type="button" className="link-btn" onClick={() => { setDays([]); setWeeks([]); }}>자동값 쓰기</button>}
        </div>
        {days.length > 0 && (
          <div className="day-row" role="group" aria-label="몇째 주">
            <span className="days-label">몇째 주</span>
            {[1, 2, 3, 4, 5].map((w) => (
              <button key={w} type="button" aria-pressed={weeks.includes(w)} className={`day${weeks.includes(w) ? ' on' : ''}`} onClick={() => toggleWeek(w)}>{w}</button>
            ))}
            <small className="hint">비워 두면 매주</small>
          </div>
        )}
        <p className="hint">위에서 날짜를 직접 체크했다면 날짜가 우선이에요.</p>
      </div>

      <div className="note-section">
        <h3>시간 <small>자동: {autoTime}</small></h3>
        {slots.map((s, i) => (
          <div className="time-row" key={i}>
            <input type="time" value={s.start} aria-label={`${i + 1}번째 시작 시간`} onChange={(e) => patchSlot(i, { start: e.target.value })} />
            <span>~</span>
            <input type="time" value={s.end} aria-label={`${i + 1}번째 끝 시간`} onChange={(e) => patchSlot(i, { end: e.target.value })} />
            <button type="button" className="link-btn" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))} aria-label={`${i + 1}번째 시간대 삭제`}>삭제</button>
          </div>
        ))}
        <div className="time-tools">
          <button type="button" className="outline small" onClick={addSlot} disabled={slots.length >= 6}>+ 시간대 추가{slots.length === 0 ? ' (오후 2시부터)' : ''}</button>
          {canLoadAuto && slots.length === 0 && <button type="button" className="link-btn" onClick={loadAutoSlots}>자동으로 읽은 시간 불러와서 고치기</button>}
          {slots.length > 0 && <button type="button" className="link-btn" onClick={() => setSlots([])}>자동값 쓰기</button>}
        </div>
        <p className="hint">하루에 여러 회차면 시간대를 여러 개 넣어요. 끝 시간을 비워 두면 시작 시각만 써요.</p>
      </div>

      <label className="note-field">
        메모
        <textarea
          value={text}
          maxLength={300}
          rows={2}
          placeholder="예) 친구랑 같이 신청 / 토요일 오후만 가능"
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      {anyEdit && (
        <button type="button" className="outline" onClick={resetEdits}>대상·날짜·시간·요일을 자동값으로 되돌리기</button>
      )}
    </Sheet>
  );
}
