import { useState } from 'react';
import CourseCard from './CourseCard';

const ms = (iso) => (iso ? new Date(iso).getTime() : Infinity);

// 처음에 보여줄 회차: 접수중 중 마감이 가장 빠른 것 → 접수예정 중 시작이 가장 빠른 것 → 첫 회차
function pickPrimary(members) {
  const open = members.filter((m) => m.status === 'open').sort((a, b) => ms(a.course.applyEnd) - ms(b.course.applyEnd));
  if (open.length) return open[0];
  const up = members.filter((m) => m.status === 'upcoming').sort((a, b) => ms(a.course.applyStart) - ms(b.course.applyStart));
  return up[0] ?? members[0];
}

const CHIP_CLS = { open: 'open', upcoming: 'upcoming', full: 'closed', closed: 'closed' };

/** 같은 프로그램의 여러 회차를 카드 하나로. 칩을 누르면 그 회차의 이용·접수 정보와 신청 링크가 보여요. */
export default function GroupCard({ members, fav, onToggleFav, home, getActions, onNote, onGoCalendar }) {
  const [selId, setSelId] = useState(null);
  const sel = members.find((m) => m.course.id === selId) ?? pickPrimary(members);

  // 이름이 같은 칩이 있으면 번호를 붙여 구분
  const seen = {};
  const labels = members.map((m) => {
    const base = m.chip;
    seen[base] = (seen[base] ?? 0) + 1;
    return { id: m.course.id, base, n: seen[base] };
  });
  const dup = Object.fromEntries(Object.entries(seen).filter(([, n]) => n > 1));
  const nameOf = (l) => (dup[l.base] ? `${l.base} #${l.n}` : l.base);

  const nOpen = members.filter((m) => m.status === 'open').length;
  const nUp = members.filter((m) => m.status === 'upcoming').length;

  const chips = (
    <div className="gbox">
      <p className="gnote">
        회차 {members.length}개{nOpen ? ` · 접수중 ${nOpen}` : ''}{nUp ? ` · 접수예정 ${nUp}` : ''}
        <span className="gnote-hint"> 날짜를 누르면 그 회차를 보여줘요</span>
      </p>
      <div className="gchips" role="group" aria-label="회차 선택">
        {members.map((m, i) => (
          <button
            key={m.course.id}
            type="button"
            aria-pressed={m.course.id === sel.course.id}
            className={`gchip ${CHIP_CLS[m.status] ?? 'closed'}${m.course.id === sel.course.id ? ' sel' : ''}`}
            onClick={() => setSelId(m.course.id)}
          >
            {m.note ? '📝 ' : ''}{nameOf(labels[i])}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <CourseCard
      course={sel.course}
      status={sel.status}
      kidMatches={sel.kidMatches}
      targetNote={sel.targetNote}
      audience={sel.audience}
      distance={sel.distance}
      home={home}
      needDetail={sel.needDetail}
      online={sel.online}
      standing={sel.standing}
      dateSource={sel.dateSource}
      focusYmd={sel.focusYmd}
      onGoCalendar={onGoCalendar}
      imageSchedule={sel.imageSchedule}
      edits={sel.edits}
      actions={getActions(sel)}
      note={sel.note}
      onNote={() => onNote(sel.course.id)}
      fav={fav}
      onToggleFav={onToggleFav}
      chips={chips}
    />
  );
}
