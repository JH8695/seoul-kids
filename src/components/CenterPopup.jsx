import { useEffect, useState } from 'react';

/**
 * 센터 팝업: 센터 목록에서 센터를 누르면 뜨는 창. 그 센터의 접수중·접수예정 프로그램을 카드로 보여줘요.
 * 메인 화면에서 고른 옵션(탭·구·요일·대상·갈 수 없는 시간 등)과 상관없이 전부 보여주고, 닫으면 그대로 돌아가요.
 * "대상 맞는 것만"은 열 때마다 체크된 상태로 시작하고, 이 팝업 안에서만 끌 수 있어요.
 */
export default function CenterPopup({ name, area, meta, items, renderItem, onSetPlace, onSetMemo, onClose }) {
  const [onlyKid, setOnlyKid] = useState(true); // 열 때마다 "대상 맞는 것만"이 체크된 상태로 시작 (원하면 팝업 안에서 끌 수 있음)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const state = meta?.s ?? null;
  const memo = meta?.memo ?? '';

  useEffect(() => {
    // Esc: 메모·옵션 창이 위에 열려 있으면 그 창이 먼저(뒤의 팝업이 같이 닫히지 않게)
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-backdrop')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fits = (it) => it.members.some((m) => m.audience.kind !== 'no');
  const shown = onlyKid ? items.filter(fits) : items;
  const fitCount = items.filter(fits).length;
  const startEdit = () => { setDraft(memo); setEditing((v) => !v); };
  const saveMemo = (text) => { onSetMemo(text); setEditing(false); };

  return (
    <div className="cp-backdrop" onClick={onClose}>
      <div className="cp" role="dialog" aria-label={`${name} 프로그램`} onClick={(e) => e.stopPropagation()}>
        <header className="cp-head">
          <div className="cp-title">
            <h2>{state === 'fav' ? '★ ' : state === 'hide' ? '✕ ' : ''}{name}</h2>
            <p className="cp-sub">{[area, `프로그램 ${items.length}개`].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className="outline" onClick={onClose}>닫기</button>
        </header>

        <div className="cp-tools">
          <button type="button" className={`cp-btn${state === 'fav' ? ' on' : ''}`} aria-pressed={state === 'fav'} onClick={() => onSetPlace(state === 'fav' ? null : 'fav')}>
            {state === 'fav' ? '★ 관심 센터' : '☆ 관심 센터로'}
          </button>
          <button type="button" className={`cp-btn${state === 'hide' ? ' on' : ''}`} aria-pressed={state === 'hide'} onClick={() => onSetPlace(state === 'hide' ? null : 'hide')}>
            {state === 'hide' ? '✕ 제외함' : '✕ 제외'}
          </button>
          <button type="button" className={`cp-btn${memo ? ' on' : ''}`} aria-expanded={editing} onClick={startEdit}>📝 {memo ? '메모 수정' : '메모'}</button>
          {fitCount < items.length && (
            <label className="cp-only">
              <input type="checkbox" checked={onlyKid} onChange={(e) => setOnlyKid(e.target.checked)} /> 대상 맞는 것만 ({fitCount}/{items.length})
            </label>
          )}
        </div>
        {memo && !editing && <p className="cp-memo">📝 {memo}</p>}
        {editing && (
          <div className="pl-edit">
            <input
              value={draft}
              maxLength={200}
              autoFocus
              placeholder="예) 지하철 25분 · 자차 15분 (주차 가능)"
              aria-label={`${name} 메모`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveMemo(draft); }}
            />
            <button type="button" className="primary" onClick={() => saveMemo(draft)}>저장</button>
            {memo && <button type="button" className="outline" onClick={() => saveMemo('')}>지우기</button>}
            <button type="button" className="outline" onClick={() => setEditing(false)}>닫기</button>
          </div>
        )}

        <div className="cp-list">
          {shown.length > 0 ? shown.map(renderItem) : <p className="empty">{items.length ? '대상에 맞는 프로그램이 없어요.' : '지금 접수중이거나 접수예정인 프로그램이 없어요.'}</p>}
        </div>
      </div>
    </div>
  );
}
