import { gradeLabel, gradeOn } from '../lib/grade';
import { useState } from 'react';
import AreaPicker from './AreaPicker';
import { buildExport, parseImport } from '../lib/backup';

const YEARS = [];
for (let y = 2012; y <= 2025; y++) YEARS.push(y);

export default function Settings({ settings, setSettings, now, onClose }) {
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setBackupMsg('복사했어요. 다른 기기의 "가져오기" 칸에 붙여넣으세요.');
    } catch {
      setBackupMsg('자동 복사가 안 돼요. 위 글을 길게 눌러 직접 복사해 주세요.');
    }
  };
  const doImport = () => {
    const r = parseImport(importText);
    if (r.error) { setBackupMsg(r.error); return; }
    if (!window.confirm('이 기기의 설정·찜·숨김·메모를 가져온 내용으로 덮어쓸까요?')) return;
    setSettings((cur) => ({ ...cur, ...r.settings }));
    setImportText('');
    setBackupMsg('가져왔어요.');
  };

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

        <AreaPicker settings={settings} setSettings={setSettings} />

        {(settings.hidden?.length ?? 0) > 0 && (
          <button className="outline" onClick={() => setSettings({ ...settings, hidden: [] })}>
            숨긴 프로그램 모두 다시 보이게 하기 ({settings.hidden.length})
          </button>
        )}

        <details className="backup">
          <summary>다른 기기로 옮기기 (내보내기 / 가져오기)</summary>
          <div className="backup-body">
            <p className="hint">설정, 찜, 숨긴 것, 메모를 글 하나로 옮겨요. 폰에서 내보내서 PC에 가져오는 식으로 쓰세요.</p>
            <button className="outline" onClick={() => { setExportText(buildExport(settings)); setBackupMsg(''); }}>내보내기 글 만들기</button>
            {exportText && (
              <>
                <textarea readOnly value={exportText} rows={4} onFocus={(e) => e.target.select()} aria-label="내보낸 글" />
                <button className="outline" onClick={doCopy}>복사</button>
              </>
            )}
            <textarea
              value={importText}
              rows={3}
              placeholder="내보낸 글을 여기에 붙여넣기"
              aria-label="가져올 글"
              onChange={(e) => setImportText(e.target.value)}
            />
            <button className="outline" disabled={!importText.trim()} onClick={doImport}>가져오기 (현재 설정을 덮어써요)</button>
            {backupMsg && <p className="hint">{backupMsg}</p>}
          </div>
        </details>

        <p className="hint">설정은 이 기기의 브라우저에만 저장되고 어디로도 전송되지 않아요.</p>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
