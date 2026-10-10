// 서울시 공공서비스예약(OpenAPI) 한 줄(row) → 앱에서 쓰는 강좌 객체로 바꾸는 변환기.
// 네트워크를 쓰지 않는 순수 함수만 모아 두어서 test/ 에서 바로 검증할 수 있어요.
import { statusOf } from '../src/lib/status.js';

// 수집할 서비스 목록. 체육시설·시설대관 등을 더 보고 싶으면 여기에 한 줄 추가하면 돼요.
export const SERVICES = [
  { name: 'ListPublicReservationEducation', source: 'education' }, // 교육
  { name: 'ListPublicReservationCulture', source: 'culture' }, // 문화행사(체험·전시)
];

// "2026-09-30 10:00:00.0" → "2026-09-30T10:00:00+09:00"
export const toIso = (s) => (s ? s.trim().replace(' ', 'T').replace(/\.\d+$/, '') + '+09:00' : null);

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', hellip: '…',
  lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', rarr: '→', larr: '←',
  times: '×', bull: '•', laquo: '«', raquo: '»',
};

// 상세내용(HTML 조각) → 읽을 수 있는 한 덩어리 글. "3. 상세내용" 앞의 공통 안내문은 버림.
export function cleanText(raw) {
  if (!raw) return '';
  let t = String(raw)
    .replace(/\\r\\n|\\n|\\t/g, ' ') // 글자 그대로 들어 있는 \r\n
    .replace(/\\(?=[*~.\-])/g, '') // 글자 그대로 들어 있는 \* 같은 이스케이프
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const i = t.indexOf('3. 상세내용');
  if (i >= 0) t = t.slice(i + '3. 상세내용'.length);
  else {
    const j = t.search(/모든 서비스의 이용은 담당 기관의 규정에 따릅니다/);
    if (j >= 0) t = t.slice(j);
  }
  return t
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/(\d)\s+(인|명|세|학년|회|분|시|월|일)(?![가-힣]{2})/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

const DAYCH = '일월화수목금토';
const dayIdx = (ch) => DAYCH.indexOf(ch);
const SEP = '[,·/・、&및와과\\s]*';

/**
 * "매주 일요일", "격주 토요일", "매주 화·목", "매주 화~금", "주말" → { weekdays: [0..6], recurrence }
 * 제목에서 먼저 찾고, 없으면 상세 글에서 찾음 ("매주 월요일 휴관" 같은 휴관 안내는 제외).
 */
export function parseWeekdays(title, detail = '') {
  const tryParse = (text, guardClosed) => {
    const re = new RegExp(`(매주|격주|매\\s*주)\\s*([${DAYCH}])(?:\\s*요일)?(?:${SEP}([${DAYCH}])(?:\\s*요일)?)?(?:\\s*[~\\-]\\s*([${DAYCH}]))?`, 'g');
    let m;
    while ((m = re.exec(text))) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
      if (guardClosed && /^\s*(?:은|는)?\s*(?:휴관|휴무|휴원|쉽니다|쉬는)/.test(after)) continue;
      const set = new Set([dayIdx(m[2])]);
      if (m[3]) set.add(dayIdx(m[3]));
      if (m[4]) {
        // 범위 "화~금"
        let a = dayIdx(m[2]);
        const b = dayIdx(m[4]);
        for (let i = 0; i < 7; i++) { set.add(a); if (a === b) break; a = (a + 1) % 7; }
      }
      const days = [...set].sort((x, y) => x - y);
      const kind = /격/.test(m[1]) ? '격주' : '매주';
      return { weekdays: days, recurrence: `${kind} ${days.map((d) => DAYCH[d]).join('·')}` };
    }
    if (/주말/.test(text) && !guardClosed) return { weekdays: [0, 6], recurrence: '주말' };
    return null;
  };
  return tryParse(title, false) ?? tryParse(detail, true) ?? { weekdays: null, recurrence: null };
}

const RE = {
  nature: /숲|생태|자연|공원|반딧불|한강|텃밭|농장|곤충|습지|산림|둘레길|정원|나무|꽃|천문|별자리|탐조|갯벌|하천|산책/,
  science: /과학|실험|코딩|로봇|천문|발명|메이커|AI|인공지능|수학/,
  museum: /박물관|미술관|기념관|전시|가옥|관람|과학관|도서관 투어/,
  history: /역사|한옥|궁|문화재|전통|근현대|유적|성곽|선사|왕릉|서원/,
  make: /만들기|공예|목공|요리|그리기|꾸미기|공방|클레이|도예|염색|나만의|쿠킹|베이킹/,
};

// 분야 태그: 한 강좌가 여러 분야에 걸칠 수 있어요.
export function classify({ minClass = '', title = '', place = '' }) {
  const text = `${title} ${place}`;
  const tags = new Set();
  const isNature = RE.nature.test(text);
  if (isNature) tags.add('nature');
  if (RE.science.test(text) || (minClass.includes('과학') && !isNature)) tags.add('science');
  if (minClass.includes('전시') || RE.museum.test(text)) tags.add('museum');
  if (minClass.includes('역사') || RE.history.test(text)) tags.add('history');
  if (minClass.includes('체험') || RE.make.test(title)) tags.add('make');
  if (!tags.size) tags.add('other');
  return [...tags];
}

// 상세 글 안의 "■ 대 상 : 초등학생 (전 학년) ..." 같은 줄을 뽑아 둠 (대상 칸이 애매할 때 보조로 씀)
export function parseDetailTarget(detail) {
  const m = detail.match(/대\s?상\s*[:：]\s*(.{2,60}?)(?=\s*[■▣◆●○▶※]|\s(?:요\s?건|수강료|기\s?간|인\s?원|일\s?시|장\s?소|신청)|$)/);
  return m ? m[1].replace(/[▹▶►※■▣◆●○\s]+$/, '').trim() : null;
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** API row 하나 → 앱용 강좌 객체 */
export function normalizeRow(row, source, now = Date.now()) {
  const title = cleanText(row.SVCNM);
  const detail = cleanText(row.DTLCONT);
  const vMin = (row.V_MIN || '').trim();
  const vMax = (row.V_MAX || '').trim();
  const timeKnown = !!(vMin && vMax && !(vMin === '00:00' && vMax === '00:00'));
  const day = (s) => (s ? s.trim().slice(0, 10) : null);
  const bg = day(row.SVCOPNBGNDT);
  const ed = day(row.SVCOPNENDDT);
  const classStart = bg ? `${bg}T${timeKnown ? vMin : '00:00'}:00+09:00` : null;
  const classEnd = ed ? `${ed}T${timeKnown ? vMax : '00:00'}:00+09:00` : null;
  const { weekdays, recurrence } = parseWeekdays(title, detail);
  const place = (row.PLACENM || '').trim();
  const c = {
    id: row.SVCID,
    source,
    title,
    maxClass: (row.MAXCLASSNM || '').trim(),
    category: (row.MINCLASSNM || '').trim(),
    tags: classify({ minClass: row.MINCLASSNM || '', title, place }),
    place: place.replace(/>/g, ' · '),
    area: (row.AREANM || '').trim(),
    pay: (row.PAYATNM || '').trim(),
    targetText: (row.USETGTINFO || '').replace(/\s+/g, ' ').trim(),
    statusText: (row.SVCSTATNM || '').trim(),
    url: row.SVCURL,
    image: row.IMGURL || null,
    tel: (row.TELNO || '').trim() || null,
    lat: num(row.Y),
    lng: num(row.X),
    classStart,
    classEnd,
    timeKnown,
    weekdays,
    recurrence,
    applyStart: toIso(row.RCPTBGNDT),
    applyEnd: toIso(row.RCPTENDDT),
    detailTarget: parseDetailTarget(detail),
    snippet: detail.slice(0, 220),
  };
  c.status = statusOf(c, now);
  return c;
}

// 이미 끝난 것(이용 기간도 접수 기간도 지남)은 파일 크기를 위해 뺌
export function isStale(c, now = Date.now()) {
  const endOfUse = c.classEnd ? new Date(c.classEnd).getTime() + 86400000 : null;
  const endOfApply = c.applyEnd ? new Date(c.applyEnd).getTime() : null;
  const latest = Math.max(endOfUse ?? 0, endOfApply ?? 0);
  return latest > 0 && latest < now;
}
