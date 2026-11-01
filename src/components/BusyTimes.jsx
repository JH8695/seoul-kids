import { DAY_LABELS, DAY_ORDER } from '../lib/weekdays';

// 설정 창: "갈 수 없는 시간" 목록. 예) 토요일 10:00~11:50
// 이 시간에 열리는 프로그램은 목록·달력에서 빠지고, 시간대가 일부만 겹치면 "일부 시간 겹침"으로 표시돼요.
export default function BusyTimes({ settings, setSettings }) {
  const list = settings.busy ?? [];
  const set = (next) => setSettings({ ...settings, busy: next });
  const patch = (id, p) => set(list.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const toggleDay = (b, d) => patch(b.id, { days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort((x, y) => x - y) });
  const add = () => set([...list, { id: `b${Date.now()}`, days: [6], start: '10:00', end: '11:50' }]);

  return (
    <section className="busy-box">
      <h3>⏰ 갈 수 없는 시간</h3>
      <p className="hint">
        이 시간에만 열리는 프로그램은 목록·달력에서 빠져요. 시간대가 여러 개(예: 10:00~11:30, 13:00~14:30)면
        겹치지 않는 시간대는 그대로 보이고, 일부만 겹치면 숨기지 않고 &quot;일부 시간 겹침&quot;으로 알려 줘요.
      </p>
      {list.map((b) => (
        <div key={b.id} className="busy-row">
          <div className="busy-days" role="group" aria-label="요일">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip${b.days.includes(d) ? ' on' : ''}`}
                aria-pressed={b.days.includes(d)}
                onClick={() => toggleDay(b, d)}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="busy-times">
            <input type="time" value={b.start} aria-label="시작 시각" onChange={(e) => patch(b.id, { start: e.target.value })} />
            <span>~</span>
            <input type="time" value={b.end} aria-label="끝 시각" onChange={(e) => patch(b.id, { end: e.target.value })} />
            <span className="grow" />
            <button type="button" className="link-btn danger" onClick={() => set(list.filter((x) => x.id !== b.id))}>삭제</button>
          </div>
          {(b.days.length === 0 || !b.start || !b.end || b.end <= b.start) && (
            <p className="hint warn">요일을 고르고, 끝 시각이 시작 시각보다 늦어야 적용돼요.</p>
          )}
        </div>
      ))}
      {list.length < 10 && (
        <button type="button" className="outline" onClick={add}>+ 갈 수 없는 시간 추가</button>
      )}
    </section>
  );
}
