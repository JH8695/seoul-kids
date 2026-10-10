// 학년·연령 계산과 모집대상 문구 해석. 모두 한국 시간(Asia/Seoul) 기준.

export const TZ = 'Asia/Seoul';

export function seoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// 학년도: 3월~12월은 해당 연도, 1~2월은 전년도
export function academicYear(date) {
  const { year, month } = seoulParts(date);
  return month >= 3 ? year : year - 1;
}

// 2017년생 → 2024학년도 초1 → 2026학년도 초3
export function gradeOn(birthYear, date) {
  return academicYear(date) - birthYear - 6;
}

// 세는나이 (2017년생 → 2026년 10살)
export function koreanAge(birthYear, date) {
  return seoulParts(date).year - birthYear + 1;
}

export function gradeLabel(g) {
  if (g >= 1 && g <= 6) return `초${g}`;
  if (g < 1) return g === 0 ? '유치원' : '유아';
  return '초등 이후';
}

const RANGE_SEP = '[~\\-～–]';

/**
 * 모집대상 원문 → 아이에게 맞는지 판정.
 * 반환: { result: 'match' | 'nomatch' | 'check', tags: string[] }
 *  - match  : 대상에 해당
 *  - nomatch: 명확히 해당하지 않음
 *  - check  : 판단 불가 (만 N세, 보호자 동반인데 자녀 나이 불명, 원문 없음 등) → "대상 확인 필요"
 *
 * 판정 순서: ① 출생연도·학년·나이 같은 "명시된 조건" → ② 없을 때만 "어린이/가족/누구나" 같은 일반 단어
 *           → ③ 성인·시니어 등 다른 연령대 단어 → ④ 보호자 전용 여부
 * grade 는 초등 학년(1~6), age 는 세는나이, birthYear 는 출생연도(모르면 null).
 */
const LV = '초등학교|초등|초|중학교|중등|중|고등학교|고등|고';
const LEVEL_OFFSET = [0, 6, 9]; // 초1~6 → 1~6, 중1~3 → 7~9, 고1~3 → 10~12
const LEVEL_MAX = [6, 3, 3];
const levelOf = (p) => (p ? (p[0] === '초' ? 0 : p[0] === '중' ? 1 : 2) : null);

const ADULT_WORDS = /시니어|노인|어르신|중년|장년|청년|성인|직장인|일반인|대학생|교사|선생님|예비부모|임산부|신혼|조부모|할머니|할아버지/;
const OTHER_AGE_WORDS = /영유아|영아|신생아|유아|미취학|중학생|중등|고등학생|청소년|10대/;
// 취학 전(유치원) 아이에게는 유아·미취학이 "다른 연령대"가 아니라 우리 아이 대상이에요
const OTHER_AGE_WORDS_PRESCHOOL = /영아|신생아|중학생|중등|고등학생|청소년|10대/;
const PRESCHOOL_WORDS = /유아|미취학|유치원/;
const SCHOOL_ONLY_WORDS = /초등|중학|고등/;
// 아이가 분명히 대상에 들어가는 말
const KID_WORDS = /초등(?:학생|생)?|초등학교|어린이|아동|온가족|가족/;
// "누구나"는 단독이면 아이도 포함이지만, "성인 누구나"처럼 다른 연령대 단어와 같이 쓰이면 그 연령대만 뜻함
const ALL_AGES_WORDS = /전연령|모든연령|누구나|제한없음|연령무관|나이무관/;
const PARENT_WORDS = /아빠|엄마|아버지|어머니|부모|양육자|학부모|보호자|맘|대디|자녀를둔|자녀가있는|자녀를키우는|자녀를양육/;
// 보호자와 아이가 함께 참여하는 프로그램이라는 단서
const PAIR_WORDS = /동반|함께|와같이|과같이|자녀와|아이와|아동과|부모와|엄마와|아빠와|가족/;

export function matchTarget(text, grade, age, birthYear = null) {
  const tags = [];
  if (!text || !text.trim()) return { result: 'check', tags };

  let t = text.replace(/\s+/g, '');
  let pos = false;
  let neg = false;
  let check = false;

  // 0) 출생연도: 2018~19년생, 2017년생~2014년생, 2017년생
  t = t.replace(new RegExp(`(\\d{4})(?:년생)?(?:${RANGE_SEP}(\\d{2,4}))?년생`, 'g'), (m, a, b) => {
    if (birthYear == null) { check = true; return ''; }
    const lo = +a;
    const hi = b ? (b.length === 2 ? +(a.slice(0, 2) + b) : +b) : lo;
    birthYear >= Math.min(lo, hi) && birthYear <= Math.max(lo, hi) ? (pos = true) : (neg = true);
    return '';
  });

  // 0-2) 개월: "36개월 미만", "12~24개월", "24개월 이상", "36개월 이하"
  //      아이의 개월 수는 세는나이로 어림함: 세는나이 N → 만 (N-2) 또는 (N-1)세 → 개월 범위 [(N-2)*12, (N-1)*12+11]
  //      범위 전체가 조건 안이면 해당, 전체가 밖이면 비해당, 걸치면 "확인 필요"
  const kidLo = Math.max(0, (age - 2) * 12);
  const kidHi = Math.max(0, (age - 1) * 12 + 11);
  t = t.replace(new RegExp(`(\\d{1,3})(?:${RANGE_SEP}(\\d{1,3}))?개월(이상|이하|미만|이내)?`, 'g'), (m, a, b, dir) => {
    let min;
    let max;
    if (b) { min = +a; max = +b; }
    else if (dir === '이상') { min = +a; max = Infinity; }
    else if (dir === '미만') { min = 0; max = +a - 1; }
    else if (dir === '이하' || dir === '이내') { min = 0; max = +a; }
    else { min = +a; max = +a; }
    if (kidLo >= min && kidHi <= max) pos = true;
    else if (kidHi < min || kidLo > max) neg = true;
    else check = true;
    return '';
  });

  // 1) 학년 (학교급 구분): 초3, 초등3~6학년, 3~6학년, 중1~3, 초등5학년~고등3학년
  //    학교급 표시가 없으면 초등으로 간주. 오른쪽에 학교급이 없으면 왼쪽 학교급을 따름.
  t = t.replace(
    new RegExp(
      `(?:(?<![가-힣])(${LV}))?(\\d{1,2})(?:학년)?(?:${RANGE_SEP}(?:(?<![가-힣])(${LV}))?(\\d{1,2})(?:학년)?)?`,
      'g',
    ),
    (m, p1, a, p2, b) => {
      if (!p1 && !p2 && !/학년/.test(m)) return m; // 학교급도 "학년"도 없으면 학년 표기가 아님 (예: 5~7세, 12명)
      const l1 = levelOf(p1) ?? 0;
      const l2 = p2 ? levelOf(p2) : l1;
      const A = +a;
      const B = b ? +b : null;
      if (A < 1 || A > LEVEL_MAX[l1]) return m;
      if (B != null && (B < 1 || B > LEVEL_MAX[l2])) return m;
      const lo = LEVEL_OFFSET[l1] + A;
      const hi = B != null ? LEVEL_OFFSET[l2] + B : lo;
      grade >= Math.min(lo, hi) && grade <= Math.max(lo, hi) ? (pos = true) : (neg = true);
      return '';
    },
  );

  // 2) 나이: 9~13세 / 만9~13세 / 만9세이상
  //    "N세"는 세는나이로 비교. "만 N세"는 생일에 따라 (세는나이-2) 또는 (세는나이-1) 이므로
  //    두 값이 모두 범위 안이면 해당, 모두 밖이면 비해당, 걸치면 "확인 필요".
  t = t.replace(
    new RegExp(`(만)?(\\d{1,2})(?:${RANGE_SEP}(\\d{1,2}))?세(이상|이하)?`, 'g'),
    (m, man, a, b, dir) => {
      const lo = +a;
      const hi = b ? +b : dir === '이상' ? 99 : dir === '이하' ? 0 : lo;
      const [min, max] = dir === '이하' ? [0, lo] : [lo, hi];
      if (man) {
        const inA = age - 2 >= min && age - 2 <= max;
        const inB = age - 1 >= min && age - 1 <= max;
        if (inA && inB) pos = true;
        else if (!inA && !inB) neg = true;
        else check = true;
        return '';
      }
      age >= min && age <= max ? (pos = true) : (neg = true);
      return '';
    },
  );

  // 3) 학년군 단어 (명시 조건으로 취급)
  if (/저학년/.test(t)) (grade >= 1 && grade <= 3 ? (pos = true) : (neg = true));
  if (/중학년/.test(t)) (grade >= 3 && grade <= 4 ? (pos = true) : (neg = true));
  if (/고학년/.test(t)) (grade >= 4 ? (pos = true) : (neg = true));

  const explicit = pos || neg || check;

  // 4) 다른 연령대 단어 (성인·시니어·중학생 등)
  const preschool = grade < 1; // 취학 전(유치원)
  const otherAge = ADULT_WORDS.test(t) || (preschool ? OTHER_AGE_WORDS_PRESCHOOL : OTHER_AGE_WORDS).test(t);
  if (otherAge) neg = true;
  // 영아·신생아만 대상이고 유아·어린이·초등 같은 말이 없으면(예: "영아 동반 가족") 우리 아이는 해당 없음
  const infantOnly = /영아|신생아|갓난|돌\s*전/.test(t) && !/유아|어린이|초등|(?<!영)아동|\d+\s*세/.test(t); // "영아동반"의 "아동"은 제외
  if (infantOnly) neg = true;
  if (preschool && /영유아/.test(t) && !explicit) { check = true; tags.push('영유아 · 나이 확인'); }

  // 5) 일반 단어는 명시 조건(학년·나이·출생연도)이 없을 때만 "해당"으로 인정
  //    - 어린이/초등/가족 등: 아이가 포함되므로 해당
  //    - 누구나/전연령: 다른 연령대 단어가 같이 있으면(예: "성인 누구나") 해당으로 보지 않음
  if (!explicit && !infantOnly) {
    if (preschool && PRESCHOOL_WORDS.test(t) && !/영유아/.test(t)) {
      pos = true;
      tags.push('유아 대상');
    } else if (preschool && SCHOOL_ONLY_WORDS.test(t) && !/어린이|가족|누구나|전연령|제한없음/.test(t)) {
      neg = true; // 초등학생만 대상인 프로그램은 유치원 아이에게 해당 없음
    } else if (KID_WORDS.test(t) && !(preschool && !/어린이|아동|가족|누구나/.test(t))) {
      pos = true;
      if (/어린이|아동|가족/.test(t)) tags.push('가족·누구나');
    } else if (ALL_AGES_WORDS.test(t) && !otherAge) {
      pos = true;
      tags.push('가족·누구나');
    }
  }

  // 팀·가족 단위 신청("4팀 (대표자 1명만 신청)")은 나이가 적혀 있지 않으면 확인 대상으로 둠
  if (/\d+팀/.test(t) && !(pos || neg || check)) {
    check = true;
    tags.push('팀 신청 · 나이 직접 확인');
  }

  // 6) 보호자 전용 여부: 보호자 단어가 있는데 "함께/동반/가족" 같은 단서가 없으면
  //    학년 조건이 있어도 그건 "자녀의 학년"이므로 참석자는 보호자 → 제외
  if (PARENT_WORDS.test(t)) {
    if (!PAIR_WORDS.test(t)) {
      tags.push('보호자·성인 대상');
      return { result: 'nomatch', tags };
    }
    tags.push('보호자 동반');
  }

  if (pos) return { result: 'match', tags };
  if (check) return { result: 'check', tags };
  if (neg) return { result: 'nomatch', tags };
  return { result: 'check', tags };
}
