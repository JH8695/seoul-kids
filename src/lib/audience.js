// "우리 아이가 개인으로 신청할 수 있는 프로그램인가?"를 판정합니다.
// grade.js 가 학년·나이로 대상을 읽고, 이 파일은 그 위에서 다음 세 가지를 따로 걸러요.
//   1) 단체 전용        제목이나 대상에 "단체"가 있고 "개인"은 없는 경우 (예: 유아단체, (단체))
//   2) 장애인 대상      장애인·발달장애·특수학교 등을 대상으로 한 경우
//   3) "제한없음"       성인 위주인 경우가 많아서, 어린이·가족 언급이 있을 때만 기본 노출
//
// 결과 kind:
//   'kid'   아이에게 해당 (기본 노출)
//   'check' 대상 확인 필요 (기본 노출)
//   'open'  "제한없음"인데 어린이·가족 언급이 없음 (설정에서 "제한없음도 포함"을 켜면 노출)
//   'no'    대상이 아님 (설정에서 "대상 안 맞는 것 포함"을 켜면 노출). reason 에 이유.

export const REASON_LABEL = {
  group: '단체 전용',
  disabled: '장애인 대상',
  adult: '성인 대상',
  age: '대상 아님',
};

const GROUP = /단체/;
const NOT_GROUP = /개인|일반/;
const DISABLED = /장애인|장애아|장애\s*(?:학생|청소년|아동|어린이|영유아)|발달장애|지적장애|특수\s*(?:학교|학급|교육)/;
const NOT_DISABLED = /비장애|통합|일반/;
const ADULT_TITLE = /성인|시니어|어르신|직장인|중장년|청년|50\s*세|60\s*세|65\s*세/;
const KID_SIGNAL = /어린이|아이|가족|유아|초등|자녀|키즈|꼬마|유치원/;
const UNRESTRICTED_WORD = /^(?:연령)?제한없음$|^누구나$|^전연령$|^연령무관$|^나이무관$|^무관$/;

const compact = (s) => (s || '').replace(/\s+/g, '');

/** 대상 칸이 "제한없음"류의 말뿐인가 ("어린이, 제한없음"처럼 다른 말이 섞이면 false) */
export function isUnrestricted(targetText) {
  const parts = compact(targetText).replace(/[()（）]/g, '').split(/[,，/·]/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => UNRESTRICTED_WORD.test(p));
}

/** 제목·대상 때문에 개인 신청이 어렵거나 우리 대상이 아닌 경우의 이유 (없으면 null) */
export function excludedReason(course) {
  const text = `${course.title ?? ''} ${course.targetText ?? ''}`;
  if (GROUP.test(text) && !NOT_GROUP.test(text)) return 'group';
  if (DISABLED.test(text) && !NOT_DISABLED.test(text)) return 'disabled';
  return null;
}

/**
 * @param course      수집된 프로그램
 * @param kidMatches  [{ kid, match: { result: 'match'|'check'|'nomatch' } }] — 지금 선택된 아이들만
 * @returns { kind, reason?, note? }
 */
export function audienceOf(course, kidMatches) {
  const reason = excludedReason(course);
  if (reason) return { kind: 'no', reason };

  const results = kidMatches.map((k) => k.match.result);
  if (results.includes('match')) {
    if (isUnrestricted(course.targetText)) {
      if (ADULT_TITLE.test(course.title ?? '')) return { kind: 'no', reason: 'adult' };
      if (KID_SIGNAL.test(`${course.title ?? ''} ${course.snippet ?? ''}`)) {
        return { kind: 'kid', note: '제한없음 · 설명에 어린이·가족 언급' };
      }
      return { kind: 'open', note: '제한없음 · 성인 위주일 수 있어요' };
    }
    return { kind: 'kid' };
  }
  if (results.includes('check')) return { kind: 'check' };
  return { kind: 'no', reason: 'age' };
}
