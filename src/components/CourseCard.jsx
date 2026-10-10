import { useState } from 'react';
import { fmtClassSchedule, fmtDateTime, daysUntil } from '../lib/format';
import { CATEGORIES } from '../data/config';

const STATUS = {
  open: { label: '접수중', cls: 'open' },
  upcoming: { label: '접수예정', cls: 'upcoming' },
  full: { label: '예약마감', cls: 'closed' },
  closed: { label: '접수종료', cls: 'closed' },
};
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

function KidPills({ kidMatches }) {
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

export default function CourseCard({ course, status, kidMatches, targetNote, distance, home }) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const st = STATUS[status] ?? STATUS.closed;
  const startsIn = status === 'upcoming' && course.applyStart ? daysUntil(course.applyStart) : null;
  const endsIn = status === 'open' && course.applyEnd ? daysUntil(course.applyEnd) : null;
  const needDetail = !course.weekdays && course.classEnd && course.classStart &&
    course.classEnd.slice(0, 10) !== course.classStart.slice(0, 10);

  return (
    <article className={`card ${st.cls}`}>
      <div className="card-top">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {startsIn != null && startsIn >= 0 && (
          <span className="dday">{startsIn === 0 ? '오늘 접수 시작' : `${startsIn}일 뒤 접수 시작`}</span>
        )}
        {endsIn != null && endsIn >= 0 && endsIn <= 7 && (
          <span className="dday urgent">{endsIn === 0 ? '오늘 접수 마감' : `${endsIn}일 뒤 접수 마감`}</span>
        )}
        <span className="grow" />
        {course.pay && <span className="count">{course.pay}</span>}
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

      {course.tags?.filter((t) => CAT[t]).length > 0 && (
        <div className="card-tags">
          {course.tags.filter((t) => CAT[t]).map((t) => (
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
          </dd>
        </div>
        <div>
          <dt>이용</dt>
          <dd>
            {fmtClassSchedule(course)}
            {needDetail && <span className="pill warn">요일은 상세 확인</span>}
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
    </article>
  );
}
