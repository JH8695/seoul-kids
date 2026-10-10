import { ALL_AREAS, NEAR_AREAS } from '../data/config';

// "선택한 구"로 볼 자치구 고르기 (설정 창과 구 선택 창에서 같이 씀)
export default function AreaPicker({ settings, setSettings }) {
  const toggle = (a) =>
    setSettings({
      ...settings,
      areas: settings.areas.includes(a) ? settings.areas.filter((x) => x !== a) : [...settings.areas, a],
    });
  return (
    <fieldset className="areas">
      <legend>"선택한 구"로 볼 자치구</legend>
      <div className="area-grid">
        {ALL_AREAS.map((a) => (
          <label key={a} className={settings.areas.includes(a) ? 'on' : ''}>
            <input type="checkbox" checked={settings.areas.includes(a)} onChange={() => toggle(a)} />
            {a}
          </label>
        ))}
      </div>
      <button type="button" className="link-btn" onClick={() => setSettings({ ...settings, areas: NEAR_AREAS })}>
        기본값으로 되돌리기
      </button>
    </fieldset>
  );
}
