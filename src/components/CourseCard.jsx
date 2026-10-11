import { useState } from 'react';
import { fmtClassSchedule, fmtDateTime, fmtTime, daysUntil } from '../lib/format';
import { CATEGORIES } from '../data/config';
import { REASON_LABEL } from '../lib/audience';
import { fmtMyDate } from '../lib/mydates';

const STATUS = {
  open: { label: '접수중', cls: 'open' },
  upcoming: { label: '접수예정', cls: 'upcoming' },
  full: { label: '예약마감', cls: 'closed' },
  closed: { label: '접수종료', cls: 'closed' },
};
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// 날짜를 누르면 달력으로 이동 (onGo 가 없으면 그냥 글자)
function DateLink({ onGo, ymd, children }) {
  if (!onGo || !ymd) return <>{children}</>;
  return (
    <button type="button" className="datelink" onClick={() => onGo(ymd)} title="달력에서 보기">
      {children}
    </button>
  );
}

export function KidPills({ kidMatches }) {
  return (
    <span className="kid-pills">
      {kidMatches.map(({ kid, match }) => {
        const mark = match.result === 'match' ? '✓' : match.result === 'check' ? '?' : '✕';
        const title =
          match.result === 'match' ? '대상에 해당' : match.result === 'check' ? '대상 확인 필요' : '대상이 아님';
        return (
          <span key={kid.id} className={`kid-pill ${match.result}`} title={title}>
            {mark} {kid.label}
          </span>
        );
      })}
    </span>
  );
}

/**
 * 프로그램 카드. chips 가 있으면(같은 프로그램의 여러 회차) 제목 아래에 회차 칩을 보여줘요.
 * onToggleFav 는 인자 없이 호출 — 어떤 항목을 찜할지는 부모가 정해요.
 */
export default function CourseCard({
  course, status, kidMatches, targetNote, audience, distance, home, fav, onToggleFav,
  needDetail, online, standing, dateSource, chips, actions, note, onNote,
  focusYmd, onGoCalendar, imageSchedule,
}) {
  const [open, setOpen] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const st = STATUS[status] ?? STATUS.closed;
  const startsIn = status === 'upcoming' && course.applyStart ? daysUntil(course.applyStart) : null;
  const endsIn = status === 'open' && course.applyEnd ? daysUntil(course.applyEnd) : null;
  const tags = (course.tags ?? []).filter((t) => CAT[t]);
  const timeText =
    course.timeKnown && course.classStart && fmtTime(course.classStart) !== '00:00'
      ? ` · ${fmtTime(course.classStart)}–${fmtTime(course.classEnd ?? course.classStart)}`
      : '';
  const closed = course.closedList ?? [];
  const closedText = closed.length ? `${closed.slice(0, 4).map(fmtMyDate).join(' · ')}${closed.length > 4 ? ' …' : ''}` : '';
  const src = course.detailSrc ?? [];

  return (
    <article className={`card ${st.cls}`}>
      <div className="card-top">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {onNote && (
          <button type="button" className={`note-btn${note ? ' has' : ''}`} onClick={onNote} aria-label={note ? '메모 보기·수정' : '메모 추가'}>
            📝 메모
          </button>
        )}
        {startsIn != null && startsIn >= 0 && (
          <span className="dday">{startsIn === 0 ? '오늘 접수 시작' : `${startsIn}일 뒤 접수 시작`}</span>
        )}
        {endsIn != null && endsIn >= 0 && endsIn <= 7 && (
          <span className="dday urgent">{endsIn === 0 ? '오늘 접수 마감' : `${endsIn}일 뒤 접수 마감`}</span>
        )}
        <span className="grow" />
        {course.pay && <span className="count">{course.pay}</span>}
        <button
          type="button"
          className={`heart${fav ? ' on' : ''}`}
          aria-pressed={!!fav}
          aria-label={fav ? '찜 해제' : '찜하기'}
          onClick={() => onToggleFav()}
        >
          {fav ? '♥' : '♡'}
        </button>
      </div>

      <div className="card-main">
        <div className="card-body">
          <h3 className="card-title">{course.title}</h3>
          <div className="card-lib">
            <strong>{course.place || '장소 미표기'}</strong>
            <span className="meta-line">
              {course.area && <span>📍 {course.area}</span>}
              {distance != null && <span title={`${home.name} 기준 직선거리(대략)`}>직선 약 {distance.toFixed(1)}km</span>}
            </span>
          </div>
        </div>
        {course.image && imgOk && (
          <img
            className="card-img"
            src={course.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        )}
      </div>

      {note && (note.text || note.dates?.length > 0) && (
        <p className="note-line">
          📝 {note.text}
          {note.dates?.length > 0 && <span className="note-dates">{note.text ? ' · ' : ''}내 일정 {note.dates.map(fmtMyDate).join(', ')}</span>}
        </p>
      )}

      {chips}

      {(tags.length > 0 || online || standing) && (
        <div className="card-tags">
          {standing && <span className="tag">🔄 상시 운영</span>}
          {online && <span className="tag">💻 온라인</span>}
          {tags.map((t) => (
            <span key={t} className="tag">{CAT[t].emoji} {CAT[t].label}</span>
          ))}
        </div>
      )}

      <dl className="rows">
        <div>
          <dt>대상</dt>
          <dd>
            {course.targetText || '원문 없음'}
            <KidPills kidMatches={kidMatches} />
            {targetNote && <span className="pill">{targetNote}</span>}
            {audience?.kind === 'no' && audience.reason && (
              <span className="pill bad">{REASON_LABEL[audience.reason]}</span>
            )}
            {audience?.note && <span className={`pill${audience.kind === 'open' ? ' warn' : ''}`}>{audience.note}</span>}
          </dd>
        </div>
        <div>
          <dt>이용</dt>
          <dd>
            {course.datesList?.length > 1 ? (
              <>
                {course.datesList.map((d, i) => (
                  <span key={d}>
                    {i > 0 && ' · '}
                    <DateLink onGo={onGoCalendar} ymd={d}>{fmtMyDate(d)}</DateLink>
                  </span>
                ))}
                {timeText}
              </>
            ) : (
              <DateLink onGo={onGoCalendar} ymd={focusYmd}>{fmtClassSchedule(course)}</DateLink>
            )}
            {closedText && <span className="closed-note">휴강 {closedText}</span>}
            {src.length > 0 && (
              <button type="button" className="pill btn" aria-expanded={showSrc} onClick={() => setShowSrc((v) => !v)}>
                {dateSource === 'detail' ? '설명 기준 날짜' : '설명에서 읽은 일정'} {showSrc ? '▴' : '▾'}
              </button>
            )}
            {showSrc && src.length > 0 && (
              <span className="src-box">
                읽은 문장:
                {src.map((t) => (<q key={t}>{t}</q>))}
              </span>
            )}
            {imageSchedule && <span className="pill warn">일정이 이미지에 있을 수 있어요</span>}
            {needDetail && <span className="pill warn">요일은 상세 확인</span>}
            {note?.dates?.length > 0 && <span className="pill">내 날짜 기준</span>}
          </dd>
        </div>
        <div>
          <dt>접수</dt>
          <dd>
            {course.applyStart ? fmtDateTime(course.applyStart) : '?'}
            {' ~ '}
            {course.applyEnd ? fmtDateTime(course.applyEnd) : '?'}
          </dd>
        </div>
      </dl>

      {course.snippet && (
        <details className="snip" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary>내용 미리보기</summary>
          <p>{course.snippet}{course.snippet.length >= 220 ? '…' : ''}</p>
        </details>
      )}

      <a className="apply" href={course.url} target="_blank" rel="noopener noreferrer">
        서울시 예약 사이트에서 보기·신청
      </a>

      {actions?.length > 0 && (
        <div className="card-foot">
          {actions.map((a) => (
            <button key={a.label} type="button" className="hide-btn" onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      )}
    </article>
  );
}
