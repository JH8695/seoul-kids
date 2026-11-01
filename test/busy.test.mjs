import assert from 'node:assert/strict';
import { classifyBusy, cleanBusy } from '../src/lib/busy.js';

const SAT_BUSY = [{ id: 'a', days: [6], start: '10:00', end: '11:50' }];
const sat = new Set([6]);
const C = (o) => classifyBusy({ busy: SAT_BUSY, slots: null, range: null, daySet: null, ...o });

// 실제 불편 사례: "10:00~11:30, 13:00~14:30" 이 10:00~14:30 한 덩어리로 합쳐져 13시 회차까지 빠졌음
const slots = [{ start: '10:00', end: '11:30', days: null }, { start: '13:00', end: '14:30', days: null }];
assert.equal(C({ slots, range: { start: '10:00', end: '14:30' }, daySet: sat }), 'partial'); // 숨기지 않음
assert.equal(C({ slots: null, range: { start: '10:00', end: '14:30' }, daySet: sat }), 'partial'); // 시간대를 모르면 확인으로
// 갈 수 있는 시간만 남은 경우
assert.equal(C({ slots: [slots[1]], range: { start: '13:00', end: '14:30' }, daySet: sat }), 'ok');
// 모든 시간대가 안 되는 시간 안
assert.equal(C({ slots: [slots[0]], range: { start: '10:00', end: '11:30' }, daySet: sat }), 'blocked');
assert.equal(C({ slots: null, range: { start: '10:30', end: '11:30' }, daySet: sat }), 'blocked');
// 요일을 모르면 숨기지 않음
assert.equal(C({ slots: null, range: { start: '10:30', end: '11:30' }, daySet: null }), 'partial');
// 다른 요일이면 상관없음 / 토·일 중 토만 막히면 확인
assert.equal(C({ range: { start: '10:30', end: '11:30' }, daySet: new Set([0]) }), 'ok');
assert.equal(C({ range: { start: '10:30', end: '11:30' }, daySet: new Set([0, 6]) }), 'partial');
// 시간 정보가 없으면 판단하지 않음
assert.equal(C({ daySet: sat }), 'ok');
// 요일 표시가 붙은 시간대: 토요일 10시대 + 일요일 13시대 → 토요일 것만 막힘 → 일요일이 남으므로 확인
const dayed = [{ start: '10:00', end: '11:30', days: [6] }, { start: '13:00', end: '14:30', days: [0] }];
assert.equal(C({ slots: dayed, range: { start: '10:00', end: '14:30' }, daySet: new Set([0, 6]) }), 'partial');
// 시간대가 경계에서 맞닿기만 하면 겹침이 아님 (11:50 끝, 11:50 시작)
assert.equal(C({ slots: [{ start: '11:50', end: '13:00', days: null }], range: { start: '11:50', end: '13:00' }, daySet: sat }), 'ok');
// 안 되는 시간이 없으면 항상 ok
assert.equal(classifyBusy({ busy: [], slots, range: null, daySet: sat }), 'ok');

// 저장 전 검증
assert.deepEqual(cleanBusy([{ id: 'x', days: [6, 6], start: '10:00', end: '11:50' }]), [{ id: 'x', days: [6], start: '10:00', end: '11:50' }]);
assert.deepEqual(cleanBusy([{ days: [], start: '10:00', end: '11:50' }, { days: [6], start: '12:00', end: '11:00' }, { days: [6], start: '9', end: '11:00' }, null]), []);
console.log('busy.test.mjs OK');
