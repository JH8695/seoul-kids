import assert from 'node:assert/strict';
import { cleanWords, hitWords } from '../src/lib/hideWords.js';

// 실제 센터 이름(주소 속에 시설명이 들어 있음): 띄어쓰기가 달라도 같은 단어로 걸림
const place = (p, t = '체험') => ({ place: p, title: t });
const W = ['서울형키즈카페'];
assert.deepEqual(hitWords(W, place('서울특별시 동대문구 답십리로66길 3 서울형 키즈카페 장안1동점 (장안동)')), W);
assert.deepEqual(hitWords(W, place('서울특별시 동대문구 사가정로2길 99 (답십리동) 서울형키즈카페 새샘공원점_답십리초등학교 후문 옆')), W);
assert.deepEqual(hitWords(W, place('서울특별시 동작구 상도로15가길 16 가온어린이집 3층 서울형키즈카페 (상도동)')), W);
// 걸리면 안 되는 것
assert.deepEqual(hitWords(W, place('서울특별시 동작구 노량진로 10 1층 (대방동)')), []);
assert.deepEqual(hitWords(W, place('서울특별시 동대문구 약령시로7길 19 동대문구육아종합지원센터 제기점 2층')), []);
// 제목에만 단어가 있어도 걸림
assert.deepEqual(hitWords(['키즈카페'], place('서울특별시 동작구 노량진로 10', '[서울형 키즈카페] 주말 놀이')), ['키즈카페']);
// 센터 이름 끝과 제목 처음이 이어 붙어 우연히 맞는 일은 없음
assert.deepEqual(hitWords(['서울형'], { place: '서울', title: '형 놀이' }), []);
// 대소문자·여러 단어
assert.deepEqual(hitWords(['abc센터', '키즈'], { place: 'ABC 센터', title: '키즈 체험' }), ['abc센터', '키즈']);
assert.deepEqual(hitWords([], place('아무거나')), []);

// 정리
assert.deepEqual(cleanWords(['  서울형  키즈카페 ', '서울형키즈카페', '키', '', null, '키즈카페']), ['서울형 키즈카페', '키즈카페']); // 같은 말(띄어쓰기만 다름)·한 글자·빈 값 제거
assert.equal(cleanWords(Array.from({ length: 30 }, (_, i) => `단어${i}번`)).length, 20); // 최대 20개
assert.equal(cleanWords(['가'.repeat(50)])[0].length, 20);
assert.deepEqual(cleanWords('x'), []);
console.log('hideWords.test.mjs OK');
