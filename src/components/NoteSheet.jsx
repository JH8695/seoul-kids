import { useMemo, useState } from 'react';
import { monthGrid, toYmd } from '../lib/calendar';
import { fmtMyDate, parseMyDates } from '../lib/mydates';
import { fmtTime } from '../lib/format';
import { gradeLabel } from '../lib/grade';
import { cleanNote } from '../lib/edits';
import Sheet from './Sheet';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const RESULT_TEXT = { match: '해당', nomatch: '해당 아님', check: '확인 필요' };

/**
 * 회차(예약 하나)의 메모와 "내 수정"(대상·시간·요일·날짜).
 * 자동으로 읽은 값이 틀렸을 때 직접 고쳐요. 고친 값이 항상 자동 판정보다 우선하고, 비워 두면 자동값을 써요.
 * orig 는 서울시 원본 일정, autoKidMatches 는 내가 고치기 전의 자동 판정이에요.
 */
export default function NoteSheet({ orig, note, kids, autoKidMatches, onSave, onClose }) {
  const win = { s: orig.classStart?.slice(0, 10) ?? null, e: orig.classEnd?.slice(0, 10) ?? null };
  const today = toYmd(new Date());
  const [text, setText] = useState(note?.text ?? '');
  const [fit, setFit] = useState(note?.fit ?? {});
  const [tStart, setTStart] = useState(note?.time?.start ?? '');
  const [tEnd, setTEnd] = useState(note?.time?.end ?? '');
  const [days, setDays] = useState(note?.days ?? []);
  const [weeks, setWeeks] = useState(note?.weeks ?? []);
  const [dates, setDates] = useState(() => [...(note?.dates ?? [])].sort());
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const start = dates[0] ?? (win.s && win.s > today ? win.s : today);
  const [cursor, setCursor] = useState({ y: +start.slice(0, 4), m: +start.slice(5, 7) });
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const autoTime =
    orig.timeKnown && orig.classStart && fmtTime(orig.classStart) !== '00:00'
      ? `${fmtTime(orig.classStart)}${orig.classEnd && fmtTime(orig.classEnd) !== fmtTime(orig.classStart) ? `–${fmtTime(orig.classEnd)}` : ''}`
      : '시간 정보 없음';
  const autoDays = orig.recurrence || '요일 정보 없음';

  const outside = (ymd) => !!((win.s && ymd < win.s) || (win.e && ymd > win.e));
  const toggle = (ymd) => setDates((d) => (d.includes(ymd) ? d.filter((x) => x !== ymd) : [...d, ymd].sort()));
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
  const resetEdits = () => { setFit({}); setTStart(''); setTEnd(''); setDays([]); setWeeks([]); };
  const anyEdit = Object.keys(fit).length > 0 || tStart || days.length > 0;

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

  const build = () =>
    cleanNote({ text, dates, fit, time: tStart ? { start: tStart, end: tEnd || null } : null, days, weeks });
  const save = () => { onSave(build()); onClose(); };

  return (
    <Sheet
      title="메모 · 내 수정"
      onClose={onClose}
      footer={
        <div className="note-actions">
          <button className="primary" onClick={save}>저장</button>
          {note && <button className="outline" onClick={() => { onSave(null); onClose(); }}>모두 지우기</button>}
          <button className="outline" onClick={onClose}>닫기</button>
        </div>
      }
    >
      <p className="note-title">{orig.title}</p>

      <label className="note-field">
        메모
        <textarea
          value={text}
          maxLength={300}
          rows={2}
          placeholder="예) 친구랑 같이 신청 / 토요일 오전만 가능"
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <div className="note-section">
        <h3>대상 <small>자동으로 읽은 게 틀리면 고쳐요</small></h3>
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
        <p className="hint">"해당"으로 고치면 단체·성인 대상·"제한없음"으로 자동으로 숨겼던 것도 보여줘요. "해당 안 됨"은 기본 목록에서 빠져요.</p>
      </div>

      <div className="note-section">
        <h3>시간 <small>자동: {autoTime}</small></h3>
        <div className="time-row">
          <input type="time" value={tStart} aria-label="시작 시간" onChange={(e) => setTStart(e.target.value)} />
          <span>~</span>
          <input type="time" value={tEnd} aria-label="끝 시간" onChange={(e) => setTEnd(e.target.value)} />
          {(tStart || tEnd) && <button type="button" className="link-btn" onClick={() => { setTStart(''); setTEnd(''); }}>자동값 쓰기</button>}
        </div>
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
      </div>

      <div className="note-section">
        <h3>내 날짜 <small>적으면 달력에 이 날짜에만 찍혀요</small></h3>
        {win.s && (
          <p className="hint">서울시 이용 기간 {fmtMyDate(win.s)}{win.e && win.e !== win.s ? ` ~ ${fmtMyDate(win.e)}` : ''}</p>
        )}
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

        {dates.length > 0 && (
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
      </div>

      {anyEdit && (
        <button type="button" className="outline" onClick={resetEdits}>대상·시간·요일을 자동값으로 되돌리기</button>
      )}
    </Sheet>
  );
}
