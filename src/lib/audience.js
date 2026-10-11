// "우리 아이가 개인으로 신청할 수 있는 프로그램인가?"를 판정합니다.
// grade.js 가 학년·나이로 대상을 읽고, 이 파일은 그 위에서 다음 세 가지를 따로 걸러요.
//   1) 단체 전용        제목이나 대상에 "단체"가 있고 "개인"은 없는 경우 (예: 유아단체, (단체))
//   2) 장애인·특정 계층  장애인, 사회적 배려대상자, 저소득·취약계층, 한부모·다문화 등을 대상으로 한 경우
//   3) "제한없음"       성인 위주인 경우가 많아서 기본으로 숨김 (설명에 어린이·가족이 나와도 마찬가지)
//
// 결과 kind:
//   'kid'   아이에게 해당 (기본 노출)
//   'check' 대상 확인 필요 (기본 노출)
//   'open'  대상이 "제한없음" ("제한없음도 포함"을 켜면 노출)
//   'no'    대상이 아님 (설정에서 "대상 안 맞는 것 포함"을 켜면 노출). reason 에 이유.

export const REASON_LABEL = {
  group: '단체 전용',
  disabled: '장애인 대상',
  targeted: '특정 계층 대상',
  adult: '성인 대상',
  age: '대상 아님',
};

const GROUP = /단체/;
const NOT_GROUP = /개인|일반/;
const DISABLED = /장애인|장애아|장애\s*(?:학생|청소년|아동|어린이|영유아)|발달장애|지적장애|특수\s*(?:학교|학급|교육)/;
const NOT_DISABLED = /비장애|통합|일반/;
// 특정 계층만 신청할 수 있는 프로그램 (일반·누구나가 같이 적혀 있으면 제외하지 않음)
const TARGETED = /사회적\s*배려|배려\s*(?:대상|계층|자)|저소득|취약\s*계층|기초\s*생활|차상위|수급자|한부모|조손|다문화|북한이탈|새터민|국가유공|보훈|위기\s*(?:청소년|가정)/;
const NOT_TARGETED = /일반|누구나|모두|통합/;
const ADULT_IN_TARGET = /성인|청년|어르신|시니어|직장인|중장년/;
// 어린이집·지역아동센터처럼 기관이 단위로 신청하는 대상
const INSTITUTION = /어린이집|지역아동센터|아동센터|학교\s*단체/;
// 부모(예비 부모)가 대상: 난임·임산부·태교·예비부부·신혼 (제목에는 "난임"처럼 분명한 말만 봄)
const ADULT_ONLY_TARGET = /난임|임산부|임부|임신|태교|예비\s*(?:부부|부모|맘|아빠)|신혼|산모|출산\s*(?:준비|예정)/;
const ADULT_ONLY_TITLE = /난임|임산부|임신부|예비\s*부부|신혼부부/;
const KID_IN_TARGET = /어린이|아동|초등|유아|자녀/;
const ADULT_TITLE = /성인|시니어|어르신|직장인|중장년|청년|50\s*세|60\s*세|65\s*세/;
// 나이·학년 정보가 들어 있는 말 (괄호 안에 이런 말이 있으면 "제한없음"이 아님)
const AGE_INFO = /\d+\s*세|학년|초등|유아|어린이|아동|가족|청소년|성인|청년|어르신|시니어|\d{4}년생/;
const UNRESTRICTED_TRIGGER = /제한없음|누구나|전연령|무관|모두|시민|주민/;

const compact = (s) => (s || '').replace(/\s+/g, '');

/**
 * 대상 칸이 "제한없음"류의 말뿐인가.
 *   "제한없음", "누구나", "제한없음(서울시민 누구나)", "제한없음(대상:사회적 배려자-일정조율가능)" → true
 *   "어린이, 제한없음", "제한없음(초등학생)" → false (나이·학년 정보가 같이 있음)
 */
export function isUnrestricted(targetText) {
  const t = compact(targetText);
  if (!t) return false;
  for (const m of t.matchAll(/[(（]([^)）]*)[)）]/g)) if (AGE_INFO.test(m[1])) return false;
  const rest = t.replace(/[(（][^)）]*[)）]/g, '');
  if (AGE_INFO.test(rest)) return false;
  return UNRESTRICTED_TRIGGER.test(t);
}

/** 제목·대상 때문에 개인 신청이 어렵거나 우리 대상이 아닌 경우의 이유 (없으면 null) */
export function excludedReason(course) {
  const text = `${course.title ?? ''} ${course.targetText ?? ''}`;
  if (GROUP.test(text) && !NOT_GROUP.test(text)) return 'group';
  // 어린이집 등 기관 단위로 신청하는 프로그램(예: 대상 "유아(어린이집 (5~7세))", 신청 1회에 10~30명)은 단체 전용
  if (INSTITUTION.test(text) && !NOT_GROUP.test(text) && !/가족|보호자|동반|부모/.test(text)) return 'group';
  // 임산부·난임·태교 등 부모(예비 부모)가 대상인 프로그램은 아이 대상이 아님. 제목의 "태교숲" 같은 장소 이름에 속지 않도록 대상 칸으로 판단
  const target = course.targetText ?? '';
  if ((ADULT_ONLY_TARGET.test(target) || ADULT_ONLY_TITLE.test(course.title ?? '')) && !KID_IN_TARGET.test(target)) return 'adult';
  if (DISABLED.test(text) && !NOT_DISABLED.test(text)) return 'disabled';
  if (TARGETED.test(text) && !NOT_TARGETED.test(text)) return 'targeted';
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
      return { kind: 'open', note: '제한없음 · 성인 위주일 수 있어요' };
    }
    // 성인·청년·어르신과 초등학생이 같이 적힌 프로그램은 일반 시민 대상이라는 표시만 붙임
    if (ADULT_IN_TARGET.test(course.targetText ?? '')) return { kind: 'kid', note: '여러 연령 대상' };
    return { kind: 'kid' };
  }
  if (results.includes('check')) return { kind: 'check' };
  return { kind: 'no', reason: 'age' };
}
