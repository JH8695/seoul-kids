// 접수 상태 판정. 서울시가 주는 상태 문구 + 접수 기간으로 판단합니다.
// 수집할 때와 화면에서 같은 규칙을 쓰기 때문에 src/lib 에 두었어요(수집기도 이 파일을 가져다 씀).
//   open     접수중
//   upcoming 접수예정 (접수 시작 전)
//   full     예약마감 (정원이 찬 상태. 취소분이 나올 수는 있음)
//   closed   접수종료
export function statusOf(c, now = Date.now()) {
  const text = c.statusText || '';
  const s = c.applyStart ? new Date(c.applyStart).getTime() : null;
  const e = c.applyEnd ? new Date(c.applyEnd).getTime() : null;
  if (/마감/.test(text)) return 'full';
  if (/종료|중지|취소|불가/.test(text)) return 'closed';
  if (e != null && now > e) return 'closed';
  if (s != null && now < s) return 'upcoming';
  if (/접수중|예약중/.test(text)) return 'open';
  if (/안내|예정|준비/.test(text)) return 'upcoming';
  return s != null && e != null ? 'open' : 'closed';
}
