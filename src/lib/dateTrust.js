// 이용 날짜를 얼마나 믿을 수 있는지. 카드에 작은 배지로 보여줘서 "이 날짜는 확인해 보세요"를 알려줘요.
//   sure : 날짜가 직접 적혀 있음(내 입력·제목·설명)
//   mid  : 요일이나 하루짜리 이용일로 계산함
//   guess: 서울시 데이터의 이용기간(시작~끝)만 알아서 실제 날짜는 다를 수 있음
// 상시 운영 시설은 \"운영 시간\"일 뿐이라 따지지 않아요(null).
export function dateTrust({ dateSource, tinfo, course, standing }) {
  if (standing) return null;
  if (dateSource === 'mine') return { level: 'sure', label: '내 날짜' };
  if (dateSource === 'edit') return { level: 'sure', label: '내가 고친 요일' };
  if (dateSource === 'title') return { level: 'sure', label: '제목에 적힌 날짜' };
  if (dateSource === 'detail') return { level: 'sure', label: '설명에서 읽은 날짜' };
  if (tinfo?.weekdays?.length) return { level: 'mid', label: '제목의 요일 기준' };
  if (course?.weekdays?.length) return { level: 'mid', label: '설명의 요일 기준' };
  const s = course?.classStart?.slice(0, 10);
  const e = course?.classEnd?.slice(0, 10);
  if (s && e && s === e) return { level: 'mid', label: '서울시 이용일 기준' };
  return { level: 'guess', label: '이용기간만 확인됨' };
}

export const TRUST_TEXT = {
  sure: (l) => `✓ ${l}`,
  mid: (l) => l,
  guess: () => '⚠ 날짜 추정 · 상세 확인',
};
export const TRUST_TITLE = {
  sure: '날짜가 글에 직접 적혀 있어요',
  mid: '요일이나 이용일로 계산한 날짜예요. 신청 전에 사이트에서 확인해 주세요',
  guess: '서울시 데이터의 이용기간만 알 수 있어서 실제 열리는 날과 다를 수 있어요. 상세 페이지에서 확인해 주세요',
};
