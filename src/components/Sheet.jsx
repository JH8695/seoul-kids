import { useEffect } from 'react';

// 아래에서 올라오는 선택 창. 바깥을 누르거나 Esc 를 누르면 닫혀요.
export default function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        {footer ?? <button className="primary" onClick={onClose}>완료</button>}
      </div>
    </div>
  );
}
