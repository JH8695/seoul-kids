// 구 제목 + 접고 펼치는 묶음. 목록과 달력 아래 목록이 같은 접힘 상태를 씀.
export default function AreaGroup({ area, count, collapsed, onToggle, itemsClass = 'area-items', children }) {
  return (
    <details
      className="area-group"
      open={!collapsed}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        if (isOpen === collapsed) onToggle(area, !isOpen); // 상태가 실제로 바뀔 때만
      }}
    >
      <summary>{area || '구 미표기'} <span className="n">{count}</span></summary>
      <div className={itemsClass}>{children}</div>
    </details>
  );
}
