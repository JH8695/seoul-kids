import { gradeLabel, gradeOn } from '../lib/grade';
import { ALL_AREAS, NEAR_AREAS } from '../data/config';

const YEARS = [];
for (let y = 2012; y <= 2025; y++) YEARS.push(y);

export default function Settings({ settings, setSettings, now, onClose }) {
  const setKid = (id, patch) =>
    setSettings({ ...settings, kids: settings.kids.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  const removeKid = (id) =>
    setSettings({
      ...settings,
      kids: settings.kids.filter((k) => k.id !== id),
      activeKids: settings.activeKids.filter((x) => x !== id),
    });
  const addKid = () =>
    setSettings({
      ...settings,
      kids: [...settings.kids, { id: `k${Date.now()}`, label: `아이${settings.kids.length + 1}`, birthYear: 2019 }],
    });
  const toggleArea = (a) =>
    setSettings({
      ...settings,
      areas: settings.areas.includes(a) ? settings.areas.filter((x) => x !== a) : [...settings.areas, a],
    });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" role="dialog" aria-label="설정" onClick={(e) => e.stopPropagation()}>
        <h2>우리 아이 설정</h2>

        <div className="ed-list">
          {settings.kids.map((k) => (
            <div className="ed-row" key={k.id}>
              <div className="ed-grid">
                <label>
                  이름(구분용)
                  <input value={k.label} maxLength={8} onChange={(e) => setKid(k.id, { label: e.target.value })} />
                </label>
                <label>
                  출생연도
                  <select value={k.birthYear} onChange={(e) => setKid(k.id, { birthYear: Number(e.target.value) })}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}년생</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ed-head">
                <span className="hint">
                  지금 <strong>{gradeLabel(gradeOn(k.birthYear, now))}</strong> · 다음 학년도(3월)에는{' '}
                  <strong>{gradeLabel(gradeOn(k.birthYear, new Date(now.getFullYear() + (now.getMonth() >= 2 ? 1 : 0), 2, 15)))}</strong>
                </span>
                <span className="grow" />
                {settings.kids.length > 1 && (
                  <button type="button" className="link-btn danger" onClick={() => removeKid(k.id)}>삭제</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {settings.kids.length < 4 && (
          <button className="outline" onClick={addKid}>+ 아이 추가</button>
        )}
        <p className="hint">
          학년은 3월에 올라가요. 각 프로그램은 <strong>이용이 시작되는 날의 학년</strong>으로 대상을 판단해요.
        </p>

        <fieldset className="areas">
          <legend>"선택한 구"로 볼 자치구</legend>
          <div className="area-grid">
            {ALL_AREAS.map((a) => (
              <label key={a} className={settings.areas.includes(a) ? 'on' : ''}>
                <input type="checkbox" checked={settings.areas.includes(a)} onChange={() => toggleArea(a)} />
                {a}
              </label>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={() => setSettings({ ...settings, areas: NEAR_AREAS })}>
            기본값으로 되돌리기
          </button>
        </fieldset>

        <p className="hint">설정은 이 기기의 브라우저에만 저장되고 어디로도 전송되지 않아요.</p>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
