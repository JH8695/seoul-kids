import { useEffect, useState } from 'react';

// 두 앱(체험·도서관)을 오가는 제목 메뉴. 같은 파일을 두 앱에 똑같이 넣어요.
export const APPS = [
  { id: 'kids', emoji: '🌳', name: '서울 아이 체험', url: 'https://jh8695.github.io/seoul-kids/' },
  { id: 'library', emoji: '🏛️', name: '도서관 강좌', url: 'https://jh8695.github.io/library-moonsen/' },
];

export default function AppSwitcher({ current, title, sub }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="switcher">
      <h1 className="switcher-h">
        <button type="button" className="switcher-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {title}<span className="switcher-caret" aria-hidden> ▾</span>
        </button>
      </h1>
      {sub && <p className="sub">{sub}</p>}
      {open && (
        <>
          <div className="pop-backdrop" onClick={() => setOpen(false)} />
          <ul className="switcher-menu" role="menu">
            {APPS.map((a) => (
              <li key={a.id} role="none">
                {a.id === current ? (
                  <button type="button" role="menuitem" className="switcher-item current" onClick={() => setOpen(false)}>
                    <span aria-hidden>{a.emoji}</span> {a.name} <span className="switcher-check" aria-label="현재 앱">✓</span>
                  </button>
                ) : (
                  <a role="menuitem" className="switcher-item" href={a.url}>
                    <span aria-hidden>{a.emoji}</span> {a.name}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
