import { useMemo, useState } from 'react';
import { monthGrid, toYmd } from '../lib/calendar';
import { fmtMyDate, parseMyDates } from '../lib/mydates';
import Sheet from './Sheet';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 회차(예약 하나)의 메모와 "내 날짜". orig 는 서울시 원본 일정(이용 기간 계산용) */
export default function NoteSheet({ orig, note, onSave, onClose }) {
  const win = { s: orig.classStart?.slice(0, 10) ?? null, e: orig.classEnd?.slice(0, 10) ?? null };
  const today = toYmd(new Date());
  const [text, setText] = useState(note?.text ?? '');
  const [dates, setDates] = useState(() => [...(note?.dates ?? [])].sort());
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const start = dates[0] ?? (win.s && win.s > today ? win.s : today);
  const [cursor, setCursor] = useState({ y: +start.slice(0, 4), m: +start.slice(5, 7) });
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const outside = (ymd) => !!((win.s && ymd < win.s) || (win.e && ymd > win.e));
  const toggle = (ymd) => setDates((d) => (d.includes(ymd) ? d.filter((x) => x !== ymd) : [...d, ymd].sort()));
  const move = (delta) =>
    setCursor(({ y, m }) => {
      const n = y * 12 + (m - 1) + delta;
      return { y: Math.floor(n / 12), m: (n % 12) + 1 };
    });

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

  const save = () => {
    const t = text.trim();
    onSave(t || dates.length ? { text: t, dates } : null);
    onClose();
  };

  return (
    <Sheet
      title="메모 · 내 날짜"
      onClose={onClose}
      footer={
        <div className="note-actions">
          <button className="primary" onClick={save}>저장</button>
          {note && <button className="outline" onClick={() => { onSave(null); onClose(); }}>지우기</button>}
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
          rows={3}
          placeholder="예) 친구랑 같이 신청 / 토요일 오전만 가능"
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <div className="note-field">
        <span>내 날짜 <small>(적으면 달력에 이 날짜에만 찍혀요)</small></span>
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
    </Sheet>
  );
}
