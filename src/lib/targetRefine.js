// 아이별 "대상" 판정을 제목·상세내용의 대상 문구로 다듬기.
// 서울시 "대상" 칸은 \"가족(어린이는 부모 동반 필수)\" 처럼 애매한 경우가 많아서,
// 제목(\"…/4학년 이상 가족\")이나 상세내용(\"모집대상 : 초등학교 4학년 이상 동반가족\")에 적힌 학년·나이가
// 더 좁으면 그쪽을 따라요.
import { matchTarget } from './grade.js';

// 학년·나이·개월이 구체적으로 적힌 문구인가 (모호한 말만 있는 상세 문구로 잘못 숨기지 않으려고)
const STRONG = /\d{1,2}\s*(?:학년|세|개월)|[저중고]학년|초등학생|초등생|초\s*\d/;

/**
 * @param match  대상 칸으로 낸 판정 { result, tags }
 * @param texts  { detailTarget, titleTarget }
 * @returns { match, note }  note 는 카드에 보여줄 근거("상세 설명의 대상 기준" 등) 또는 null
 */
export function refineMatch(match, { detailTarget = null, titleTarget = null } = {}, g, age, birthYear) {
  let note = null;
  // 상세내용: 대상 칸이 \"확인 필요\"면 상세내용으로 판정, 아니면 구체적인 조건이 더 좁을 때만 따름
  if (detailTarget) {
    const m2 = matchTarget(detailTarget, g, age, birthYear);
    if (match.result === 'check' && m2.result !== 'check') {
      match = m2;
      note = '상세 설명 기준';
    } else if (STRONG.test(detailTarget)) {
      if (m2.result === 'nomatch' && match.result !== 'nomatch') {
        match = { result: 'nomatch', tags: [...match.tags, '상세 설명 기준'] };
        note = '상세 설명의 대상 기준';
      } else if (m2.result === 'match' && match.result === 'check') {
        match = m2;
        note = '상세 설명의 대상 기준';
      }
    }
  }
  // 제목: \"초등 1~3학년\" 처럼 학년이 적혀 있으면 대상 칸보다 좁은 조건으로 봄
  if (titleTarget) {
    const m3 = matchTarget(titleTarget, g, age, birthYear);
    if (m3.result === 'nomatch' && match.result !== 'nomatch') {
      match = { result: 'nomatch', tags: [...match.tags, '제목 기준'] };
      note = '제목의 학년 기준';
    } else if (m3.result === 'match' && match.result === 'check') {
      match = m3;
      note = '제목의 학년 기준';
    }
  }
  return { match, note };
}
