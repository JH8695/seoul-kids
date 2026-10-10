// test/fixtures 의 실제 응답 10건으로 화면 확인용 샘플(src/data/sampleCourses.json)을 만듭니다.
import fs from 'node:fs';
import { normalizeRow } from './seoul.mjs';

const load = (f) => JSON.parse(fs.readFileSync(new URL(`../test/fixtures/${f}`, import.meta.url), 'utf8'));
const NOW = new Date('2026-10-10T09:00:00+09:00').getTime();
const courses = [
  ...load('education.json').map((r) => normalizeRow(r, 'education', NOW)),
  ...load('culture.json').map((r) => normalizeRow(r, 'culture', NOW)),
];
fs.writeFileSync(
  new URL('../src/data/sampleCourses.json', import.meta.url),
  JSON.stringify({ meta: { isSample: true, fetchedAt: null, errors: [] }, courses }, null, 1),
);
console.log(`샘플 ${courses.length}건 저장`);
