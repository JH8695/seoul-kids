import { useState } from 'react';
import { fmtClassSchedule, fmtDate, fmtDateTime, fmtTime, daysUntil } from '../lib/format';
import { CATEGORIES } from '../data/config';
import { REASON_LABEL } from '../lib/audience';
import { TRUST_TEXT, TRUST_TITLE } from '../lib/dateTrust';
import { applyEvent, buildIcs, eventText, useEvents } from '../lib/ics';
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
        // 판정 근거: 마지막 태그 한 개를 작게 덧붙임 (예: "유아 항목 해당")
        const why = match.edited ? null : (match.tags ?? []).filter((t) => t !== '내 수정').slice(-1)[0];
        return (
          <span key={kid.id} className={`kid-pill ${match.result}`} title={why ? `${title} · ${why}` : title}>
            {mark} {kid.label}{match.edited ? ' ✎' : ''}
            {why && <small className="kid-why"> · {why}</small>}
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
  needDetail, online, standing, dateSource, chips, actions, note, onNote, busy,
  placeSt, onPlace, isNew, trust,
  focusYmd, onGoCalendar, imageSchedule, edits = [],
}) {
  const [open, setOpen] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const [placeMenu, setPlaceMenu] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calMsg, setCalMsg] = useState('');
  const [imgOk, setImgOk] = useState(true);
  const st = STATUS[status] ?? STATUS.closed;
  const startsIn = status === 'upcoming' && course.applyStart ? daysUntil(course.applyStart) : null;
  const endsIn = status === 'open' && course.applyEnd ? daysUntil(course.applyEnd) : null;
  const tags = (course.tags ?? []).filter((t) => CAT[t]);
  const DAYCH = '일월화수목금토';
  const slotText = (course.timeSlots ?? [])
    .map((s) => `${s.days?.length && s.days.length < 7 ? `${s.days.map((d) => DAYCH[d]).join('·')} ` : ''}${s.start}–${s.end}`)
    .join(' · ');
  const timeText = course.timeSlots?.length > 1
    ? ` · ${slotText}` // 설명에서 시간대를 따로 읽은 경우: 합쳐진 10:00–14:30 대신 나눠서 보여줌
    : course.timeKnown && course.classStart && fmtTime(course.classStart) !== '00:00'
      ? ` · ${fmtTime(course.classStart)}${course.classEnd && fmtTime(course.classEnd) !== fmtTime(course.classStart) ? `–${fmtTime(course.classEnd)}` : ''}`
      : '';
  const closed = course.closedList ?? [];
  const closedText = closed.length ? `${closed.slice(0, 4).map(fmtMyDate).join(' · ')}${closed.length > 4 ? ' …' : ''}` : '';
  // 캘린더에 담을 수 있는 일정: 앞으로 올 접수 시작, 그리고 이 회차의 이용 일정
  const calEvents = [];
  const ae = applyEvent(course);
  if (ae) calEvents.push({ key: 'apply', label: `접수 시작 ${fmtDate(course.applyStart)} ${fmtTime(course.applyStart)}`, events: [ae] });
  const ue = useEvents(course, focusYmd);
  if (ue.length) calEvents.push({ key: 'use', label: `이용 ${fmtMyDate(focusYmd)}`, events: ue });
  const saveIcs = (name, text) => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setCalMsg('파일을 받았어요. 다운로드 폴더의 .ics 파일을 캘린더 앱(또는 PC의 네이버캘린더)에서 가져오세요.');
    } catch { setCalMsg('파일을 만들지 못했어요. \"정보 복사\"를 써 주세요.'); }
  };
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); setCalMsg('복사했어요. 캘린더 앱의 새 일정에 붙여넣으세요.'); }
    catch { setCalMsg(`자동 복사가 안 돼요. 아래 글을 직접 복사해 주세요:\n${text}`); }
  };
  const src = [...(course.detailSrc ?? []), ...(course.timeSlots?.length > 1 ? course.timeSlotSrc ?? [] : [])];

  return (
    <article className={`card ${st.cls}`}>
      <div className="card-top">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {onNote && (
          <button type="button" className={`note-btn${note ? ' has' : ''}`} onClick={onNote} aria-label={note ? '메모 보기·수정' : '메모 추가'}>
            📝 메모
          </button>
        )}
        {isNew && <span className="badge new" title="최근 새로 올라온 프로그램이에요">NEW</span>}
        {startsIn != null && startsIn >= 0 && (
          <span className="dday">
            {startsIn === 0 ? '오늘' : fmtDate(course.applyStart)} {fmtTime(course.applyStart)} 접수 시작{startsIn > 0 ? ` · ${startsIn}일 뒤` : ''}
          </span>
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
            {onPlace && course.place ? (
              <button
                type="button"
                className={`place-btn${placeSt ? ` ${placeSt}` : ''}`}
                aria-expanded={placeMenu}
                title="눌러서 관심 장소·제외 장소로 정해요"
                onClick={() => setPlaceMenu((v) => !v)}
              >
                {placeSt === 'fav' ? '★ ' : placeSt === 'hide' ? '✕ ' : ''}{course.place}
              </button>
            ) : (
              <strong>{course.place || '장소 미표기'}</strong>
            )}
            {placeMenu && onPlace && (
              <span className="place-menu">
                <button type="button" onClick={() => { onPlace(placeSt === 'fav' ? null : 'fav'); setPlaceMenu(false); }}>
                  {placeSt === 'fav' ? '★ 관심 장소 해제' : '★ 관심 장소로'}
                </button>
                <button type="button" onClick={() => { onPlace(placeSt === 'hide' ? null : 'hide'); setPlaceMenu(false); }}>
                  {placeSt === 'hide' ? '제외 해제' : '✕ 이 장소 제외'}
                </button>
              </span>
            )}
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
            {busy === 'partial' && <span className="pill busy" title="내가 정한 갈 수 없는 시간과 일부 겹쳐요. 시간대를 확인해 주세요">⏰ 일부 시간 겹침</span>}
            {busy === 'blocked' && <span className="pill busy-no" title="찜해 둔 프로그램이라 숨기지 않았어요">⏰ 갈 수 없는 시간</span>}
            {src.length > 0 && (
              <button type="button" className="pill btn" aria-expanded={showSrc} onClick={() => setShowSrc((v) => !v)}>
                읽은 문장 {showSrc ? '▴' : '▾'}
              </button>
            )}
            {showSrc && src.length > 0 && (
              <span className="src-box">
                읽은 문장:
                {src.map((t) => (<q key={t}>{t}</q>))}
              </span>
            )}
            {imageSchedule && <span className="pill warn">일정이 이미지에 있을 수 있어요</span>}
            {edits.filter((x) => x !== '날짜').length > 0 && (
              <span className="pill edit">✎ 내 수정: {edits.filter((x) => x !== '날짜').join('·')}</span>
            )}
            {needDetail && <span className="pill warn">요일은 상세 확인</span>}
            {note?.dates?.length > 0 && <span className="pill">내 날짜 기준</span>}
            {trust && <span className={`pill trust ${trust.level}`} title={TRUST_TITLE[trust.level]}>{TRUST_TEXT[trust.level](trust.label)}</span>}
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

      {calEvents.length > 0 && (
        <div className="cal-add">
          <button type="button" className="outline small" aria-expanded={calOpen} onClick={() => { setCalOpen((v) => !v); setCalMsg(''); }}>
            📅 캘린더에 담기 {calOpen ? '▴' : '▾'}
          </button>
          {calOpen && (
            <div className="cal-add-box">
              {calEvents.map((g) => (
                <div key={g.key} className="cal-line">
                  <span className="cal-line-t">{g.label}</span>
                  <button type="button" onClick={() => saveIcs(`seoul-kids-${course.id}-${g.key}.ics`, buildIcs(g.events))}>.ics 받기</button>
                  <button type="button" onClick={() => copyText(g.events.map(eventText).join('\n\n'))}>정보 복사</button>
                </div>
              ))}
              {calMsg && <p className="hint">{calMsg}</p>}
              <p className="hint">
                네이버캘린더는 <strong>PC 웹</strong>의 환경설정 → &quot;외부일정 가져오기&quot;에 .ics 파일을 올리면 폰 앱에도 같이 보여요(예전 안내 기준이라 메뉴 이름이 다를 수 있어요).
                폰 앱이 .ics를 바로 가져오는지는 확인하지 못해서, 폰에서는 <strong>정보 복사</strong>를 눌러 일정에 붙여넣는 방법을 추천해요.
              </p>
            </div>
          )}
        </div>
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
