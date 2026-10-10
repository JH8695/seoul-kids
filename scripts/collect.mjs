// 사용법: SEOUL_API_KEY=인증키 node scripts/collect.mjs   → public/data/courses.json 생성
// 서울 열린데이터광장 "공공서비스예약" OpenAPI 를 읽어 한 파일로 정리합니다.
// 인증키는 코드에 쓰지 않고 환경변수(GitHub 에서는 Secret)로만 받아요.
import fs from 'node:fs/promises';
import { SERVICES, normalizeRow, isStale } from './seoul.mjs';

const KEY = process.env.SEOUL_API_KEY;
const BASE = process.env.SEOUL_API_BASE || 'http://openapi.seoul.go.kr:8088';
const PAGE = 1000; // 서울 OpenAPI 는 한 번에 최대 1000건
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const describe = (e) => `${e.message || e}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`;

if (!KEY) {
  console.error('SEOUL_API_KEY 환경변수가 없어요. 인증키를 넣고 다시 실행하세요.');
  process.exit(1);
}

async function getJson(url, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      // 인증키가 주소에 들어 있으니 로그에는 서비스 이름만 남김
      console.warn(`요청 실패(${attempt}/3) ${label}: ${describe(e)}`);
      if (attempt === 3) throw e;
      await sleep(attempt * 3000);
    }
  }
}

async function fetchService({ name, source }) {
  const rows = [];
  let total = Infinity;
  for (let start = 1; start <= total; start += PAGE) {
    const url = `${BASE}/${KEY}/json/${name}/${start}/${start + PAGE - 1}/`;
    const json = await getJson(url, `${name} ${start}`);
    const body = json[name];
    const result = body?.RESULT ?? json.RESULT;
    if (!body || (result && result.CODE !== 'INFO-000')) {
      throw new Error(`${result?.CODE ?? '응답 형식 오류'} ${result?.MESSAGE ?? ''}`.trim());
    }
    total = body.list_total_count ?? rows.length;
    rows.push(...(body.row ?? []));
    await sleep(500);
  }
  console.log(`${name}: 전체 ${total}건 중 ${rows.length}건 읽음`);
  return rows.map((r) => ({ row: r, source }));
}

const meta = { fetchedAt: new Date().toISOString(), errors: [], counts: {} };
const byId = new Map();
const now = Date.now();

for (const svc of SERVICES) {
  try {
    const items = await fetchService(svc);
    let kept = 0;
    for (const { row, source } of items) {
      if (!row.SVCID) continue;
      const c = normalizeRow(row, source, now);
      if (isStale(c, now)) continue; // 이미 끝난 것은 뺌
      byId.set(c.id, c);
      kept++;
    }
    meta.counts[svc.source] = { read: items.length, kept };
  } catch (e) {
    // 실패한 출처의 옛 데이터는 남기지 않음 (현재 정보처럼 보이면 안 되므로)
    meta.errors.push({ source: svc.source === 'education' ? '교육' : '문화행사', message: describe(e) });
    console.error(`${svc.name} 수집 실패:`, describe(e));
  }
}

const courses = [...byId.values()];
await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/courses.json', JSON.stringify({ meta, courses }));
const areas = {};
courses.forEach((c) => { areas[c.area || '미분류'] = (areas[c.area || '미분류'] ?? 0) + 1; });
console.log('구별 건수:', JSON.stringify(areas));
console.log(`저장 완료: ${courses.length}건`);
if (meta.errors.length === SERVICES.length) process.exit(1);
