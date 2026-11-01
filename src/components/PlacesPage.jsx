import { useMemo, useRef, useState } from 'react';
import { buildPlaceList } from '../lib/placeList';

// 업체(장소) 페이지: 가나다 순 목록. ★ 관심 장소는 항상 맨 위, ✕ 제외 장소는 맨 아래(접힘).
// 장소 이름을 누르면 그 장소의 프로그램만 목록에 보여요.
export default function PlacesPage({ rows, places, scopeLabel, onPick, onSetPlace, onClose }) {
  const [q, setQ] = useState('');
  const bodyRef = useRef(null);
  const { fav, hide, normal } = useMemo(() => buildPlaceList({ rows, places, q }), [rows, places, q]);
  const jump = (initial) => bodyRef.current?.querySelector(`[data-initial="${initial}"]`)?.scrollIntoView({ block: 'start' });

  const meta = (it) => {
    const bits = [it.area];
    if (it.programs > 0) {
      bits.push(`프로그램 ${it.programs}`);
      if (it.open) bits.push(`접수중 ${it.open}`);
      if (it.upcoming) bits.push(`접수예정 ${it.upcoming}`);
    } else {
      bits.push('지금 올라온 프로그램 없음');
    }
    return bits.filter(Boolean).join(' · ');
  };
  const row = (it) => (
    <li key={it.key} className={`pl-row${it.programs === 0 ? ' empty' : ''}`}>
      <button type="button" className="pl-main" onClick={() => onPick(it)} disabled={it.programs === 0 && it.state !== 'hide'}>
        <span className="pl-name">
          {it.state === 'fav' ? '★ ' : it.state === 'hide' ? '✕ ' : ''}{it.name}
          {it.state === 'fav' && it.news > 0 && <span className="badge new">NEW {it.news}</span>}
        </span>
        <span className="pl-meta">{meta(it)}</span>
      </button>
      <button
        type="button"
        className={`pl-act${it.state === 'fav' ? ' on' : ''}`}
        aria-label={it.state === 'fav' ? `${it.name} 관심 해제` : `${it.name} 관심 장소로`}
        aria-pressed={it.state === 'fav'}
        onClick={() => onSetPlace(it, it.state === 'fav' ? null : 'fav')}
      >
        {it.state === 'fav' ? '★' : '☆'}
      </button>
      <button
        type="button"
        className={`pl-act${it.state === 'hide' ? ' on' : ''}`}
        aria-label={it.state === 'hide' ? `${it.name} 제외 해제` : `${it.name} 제외`}
        aria-pressed={it.state === 'hide'}
        onClick={() => onSetPlace(it, it.state === 'hide' ? null : 'hide')}
      >
        ✕
      </button>
    </li>
  );

  const total = normal.reduce((n, b) => n + b.items.length, 0) + fav.length + hide.length;
  return (
    <div className="places-page" role="dialog" aria-label="업체 목록">
      <header className="pl-head">
        <h2>업체(장소) 목록</h2>
        <button type="button" className="outline" onClick={onClose}>닫기</button>
      </header>
      <input type="search" className="search" placeholder="장소 이름 검색" aria-label="장소 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="hint">{scopeLabel} · 이름을 누르면 그 장소의 프로그램만 보여요. ☆는 관심(맨 위 고정), ✕는 제외예요.</p>
      {normal.length > 0 && (
        <nav className="pl-jump" aria-label="초성으로 건너뛰기">
          {normal.map((b) => (<button key={b.initial} type="button" onClick={() => jump(b.initial)}>{b.initial}</button>))}
        </nav>
      )}
      <div className="pl-body" ref={bodyRef}>
        {fav.length > 0 && (
          <section>
            <h3 className="pl-h fav">★ 관심 장소 {fav.length}</h3>
            <ul className="pl-list">{fav.map(row)}</ul>
          </section>
        )}
        {normal.map((b) => (
          <section key={b.initial} data-initial={b.initial}>
            <h3 className="pl-h">{b.initial} <small>{b.items.length}</small></h3>
            <ul className="pl-list">{b.items.map(row)}</ul>
          </section>
        ))}
        {total === 0 && <p className="empty">{q ? '검색어에 맞는 장소가 없어요.' : '보여줄 장소가 없어요. 구나 대상 조건을 바꿔 보세요.'}</p>}
        {hide.length > 0 && (
          <details className="pl-hide">
            <summary>✕ 제외한 장소 {hide.length}개 · 눌러서 펼치기</summary>
            <ul className="pl-list">{hide.map(row)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}
