// "숨길 단어": 센터 이름이나 프로그램 제목에 이 단어가 들어 있으면 목록·달력·센터 목록에서 숨겨요.
// 예) "서울형키즈카페" 를 넣으면 "서울형 키즈카페", "서울형키즈카페" 모두 걸러져요(띄어쓰기·대소문자 무시).
export const MAX_WORDS = 20;
const squash = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** 저장 전 정리: 공백 정리, 20자까지, 두 글자 미만은 버림(너무 많이 걸러지는 걸 막음), 같은 말은 한 번만 */
export function cleanWords(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const w of list) {
    const t = String(w ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
    const k = squash(t);
    if (k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

/** 이 강좌에 걸리는 단어들 (센터 이름과 프로그램 제목을 따로 검사 — 두 글이 이어 붙어 우연히 맞는 일이 없게) */
export function hitWords(words, course) {
  if (!words?.length) return [];
  const hay = [squash(course?.place), squash(course?.title)];
  return words.filter((w) => {
    const k = squash(w);
    return k.length >= 2 && hay.some((h) => h.includes(k));
  });
}
