import { useMemo, useRef, useState } from 'react';
import PlaceEdit from './PlaceEdit';
import { timesText } from '../lib/places.js';
import { buildPlaceList } from '../lib/placeList';

// 센터 목록 페이지: 가나다 순 목록. ★ 관심 센터는 항상 맨 위, ✕ 제외 센터는 맨 아래(접힘).
// 센터 이름을 누르면 그 센터의 프로그램만 목록에 보여요. 📝 로 센터마다 메모(지하철·자차 소요 시간 등)를 남겨요.
export default function PlacesPage({ rows, places, myAreas = [], scopeValue = 'all', onScope, onPick, onSetPlace, onSetInfo, onClose }) {
  const [q, setQ] = useState('');
  const [editKey, setEditKey] = useState(null);
  const bodyRef = useRef(null);
  // 구 범위: all(서울 전체) | mine(내가 선택한 구) | 구 이름
  const areaOk = useMemo(
    () => (scopeValue === 'all' ? () => true : scopeValue === 'mine' ? (a) => myAreas.includes(a) : (a) => a === scopeValue),
    [scopeValue, myAreas],
  );
  // 구별 센터 수 (드롭다운에 보여줌): 지금 올라온 프로그램이 있는 센터 기준
  const areaCounts = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (!r.placeKey || !r.course.area) return;
      if (!m.has(r.course.area)) m.set(r.course.area, new Set());
      m.get(r.course.area).add(r.placeKey);
    });
    if (scopeValue !== 'all' && scopeValue !== 'mine' && !m.has(scopeValue)) m.set(scopeValue, new Set());
    return [...m.entries()].map(([name, set]) => ({ name, n: set.size })).sort((x, y) => x.name.localeCompare(y.name, 'ko'));
  }, [rows, scopeValue]);
  const totalCenters = useMemo(() => new Set(rows.map((r) => r.placeKey).filter(Boolean)).size, [rows]);
  const { fav, hide, normal } = useMemo(() => buildPlaceList({ rows, places, q, areaOk }), [rows, places, q, areaOk]);
  const jump = (initial) => bodyRef.current?.querySelector(`[data-initial="${initial}"]`)?.scrollIntoView({ block: 'start' });
  const startEdit = (it) => setEditKey(editKey === it.key ? null : it.key);
  const saveInfo = (it, info) => { onSetInfo(it, info); setEditKey(null); };

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
    <li key={it.key} className="pl-item">
      <div className={`pl-row${it.programs === 0 ? ' empty' : ''}`}>
        <button type="button" className="pl-main" onClick={() => onPick(it)} disabled={it.programs === 0 && it.state !== 'hide'}>
          <span className="pl-name">
            {it.state === 'fav' ? '★ ' : it.state === 'hide' ? '✕ ' : ''}{it.name}
            {it.state === 'fav' && it.news > 0 && <span className="badge new">NEW {it.news}</span>}
          </span>
          <span className="pl-meta">{meta(it)}</span>
          {timesText(places[it.key]) && <span className="pl-time">{timesText(places[it.key])}</span>}
          {it.memo && <span className="pl-memo">📝 {it.memo}</span>}
        </button>
        <button
          type="button"
          className={`pl-act${it.memo || timesText(places[it.key]) ? ' on' : ''}`}
          aria-label={`${it.name} 이동시간·메모`}
          aria-expanded={editKey === it.key}
          title="이동시간(대중교통·자차)·메모"
          onClick={() => startEdit(it)}
        >
          ⏱
        </button>
        <button
          type="button"
          className={`pl-act${it.state === 'fav' ? ' on' : ''}`}
          aria-label={it.state === 'fav' ? `${it.name} 관심 해제` : `${it.name} 관심 센터로`}
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
      </div>
      {editKey === it.key && <PlaceEdit name={it.name} memo={it.memo} tr={places[it.key]?.tr} cr={places[it.key]?.cr} onSave={(info) => saveInfo(it, info)} onClose={() => setEditKey(null)} />}
    </li>
  );

  const total = normal.reduce((n, b) => n + b.items.length, 0) + fav.length + hide.length;
  return (
    <div className="places-page" role="dialog" aria-label="센터 목록">
      <header className="pl-head">
        <h2>센터 목록</h2>
        <button type="button" className="outline" onClick={onClose}>닫기</button>
      </header>
      <div className="pl-filter">
        <select value={scopeValue} onChange={(e) => onScope?.(e.target.value)} aria-label="구 선택">
          <option value="all">서울 전체 ({totalCenters}곳)</option>
          <option value="mine">내가 선택한 구 ({myAreas.length}곳)</option>
          {areaCounts.map((a) => (<option key={a.name} value={a.name}>{a.name} ({a.n})</option>))}
        </select>
        <input type="search" className="search" placeholder="센터 이름 검색" aria-label="센터 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="hint">이름을 누르면 그 센터의 프로그램이 팝업으로 떠요. ⏱ 이동시간(대중교통·자차 분)·메모, ☆ 관심(맨 위 고정), ✕ 제외예요. 센터 이름 앞의 &quot;서울특별시 ○○구&quot;는 줄여서 보여줘요.</p>
      {normal.length > 0 && (
        <nav className="pl-jump" aria-label="초성으로 건너뛰기">
          {normal.map((b) => (<button key={b.initial} type="button" onClick={() => jump(b.initial)}>{b.initial}</button>))}
        </nav>
      )}
      <div className="pl-body" ref={bodyRef}>
        {fav.length > 0 && (
          <section>
            <h3 className="pl-h fav">★ 관심 센터 {fav.length}</h3>
            <ul className="pl-list">{fav.map(row)}</ul>
          </section>
        )}
        {normal.map((b) => (
          <section key={b.initial} data-initial={b.initial}>
            <h3 className="pl-h">{b.initial} <small>{b.items.length}</small></h3>
            <ul className="pl-list">{b.items.map(row)}</ul>
          </section>
        ))}
        {total === 0 && <p className="empty">{q ? '검색어에 맞는 센터가 없어요.' : '보여줄 센터가 없어요. 구나 대상 조건을 바꿔 보세요.'}</p>}
        {hide.length > 0 && (
          <details className="pl-hide">
            <summary>✕ 제외한 센터 {hide.length}개 · 눌러서 펼치기</summary>
            <ul className="pl-list">{hide.map(row)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}
