// 서울시 데이터의 "구" 칸이 비어 있는(또는 구가 아닌) 프로그램의 구를 글에서 알아냄.
//   예) 제목 "…성벽흔적구간(성북권역)" → 성북구, 장소 "서울특별시 성북구 삼선교로 …" → 성북구
// 확실할 때만 채우고, 애매하면(구가 둘 이상 나오거나 근거가 약하면) 비워 둬요 — 틀린 구에 넣는 것보다 "구 미표기"가 나음.
import { ALL_AREAS } from '../data/config.js';

const GU = new Set(ALL_AREAS);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GU_RE = new RegExp(`(?<![가-힣])(${[...GU].map(esc).join('|')})`, 'g'); // "서초구"가 "○○서초구"의 일부로 걸리지 않게

const distinctGu = (text) => [...new Set([...String(text ?? '').matchAll(GU_RE)].map((m) => m[1]))];
// 장소를 가리키는 말 바로 뒤의 구만 (주최·문의처 주소의 구와 헷갈리지 않게)
const VENUE_RE = /(?:출발\s*장소|집결\s*장소|만나는\s*(?:곳|장소)|장\s*소|위\s*치|주\s*소|오시는\s*길)[^.\n○■▶▷※ㅇ]{0,60}/g; // 다음 항목(○ ㅇ ■ 같은 글머리)이 시작되면 거기서 끊음

/**
 * @param rawArea 서울시 데이터의 구 칸
 * @param ctx { place, title, detail }
 * @returns 구 이름. 알아내지 못하면 rawArea 그대로
 */
export function inferArea(rawArea, { place = '', title = '', detail = '' } = {}) {
  const raw = String(rawArea ?? '').trim();
  if (GU.has(raw)) return raw;

  // 1) 장소 이름에 구가 하나만 나오면
  const p = distinctGu(place);
  if (p.length === 1) return p[0];

  // 2) 제목: "(성북권역)" 은 성북구, 그 밖에 "[성북구]" 같은 표기. ("인왕권역"처럼 구 이름이 아닌 권역은 건너뜀)
  const kw = [...String(title).matchAll(/([가-힣]{2,3})권역/g)].map((m) => `${m[1]}구`).filter((g) => GU.has(g));
  if (kw.length === 1) return kw[0];
  const t = distinctGu(title);
  if (t.length === 1) return t[0];

  // 3) 상세내용: "장소 / 출발장소 / 주소 …" 뒤에 적힌 구가 하나뿐일 때만
  const v = new Set();
  for (const m of String(detail).matchAll(VENUE_RE)) distinctGu(m[0]).forEach((g) => v.add(g));
  if (v.size === 1) return [...v][0];

  return raw;
}
