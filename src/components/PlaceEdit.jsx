import { useState } from 'react';

/**
 * 센터 메모 + 이동시간(분) 입력 칸. 센터 목록·센터 팝업에서 같이 씀.
 * 이동시간은 직접 입력하고, 메인 화면의 "이동시간" 필터가 이 값을 써요(비우면 지움).
 */
export default function PlaceEdit({ name, memo = '', tr = null, cr = null, onSave, onClose }) {
  const [m, setM] = useState(memo);
  const [t, setT] = useState(tr ? String(tr) : '');
  const [c, setC] = useState(cr ? String(cr) : '');
  const save = () => onSave({ memo: m, tr: t === '' ? null : Number(t), cr: c === '' ? null : Number(c) });
  const onKey = (e) => { if (e.key === 'Enter') save(); };
  const num = (v, set, label) => (
    <label className="pe-time">
      <span>{label}</span>
      <input type="number" inputMode="numeric" min="1" max="600" value={v} placeholder="분" aria-label={`${name} ${label} 분`} onChange={(e) => set(e.target.value)} onKeyDown={onKey} />
      <span>분</span>
    </label>
  );
  return (
    <div className="pl-edit pe">
      <div className="pe-times">
        {num(t, setT, '🚇 대중교통')}
        {num(c, setC, '🚗 자차')}
      </div>
      <input value={m} maxLength={200} placeholder="메모 예) 주차 가능, 유모차 OK" aria-label={`${name} 메모`} onChange={(e) => setM(e.target.value)} onKeyDown={onKey} />
      <div className="pe-btns">
        <button type="button" className="primary" onClick={save}>저장</button>
        <button type="button" className="outline" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
