import { useState } from 'react';
import { cleanWords, MAX_WORDS } from '../lib/hideWords';

// 설정 창: 숨길 단어. 센터 이름이나 프로그램 제목에 들어 있으면 목록·달력·센터 목록에서 빠져요.
export default function HideWords({ settings, setSettings, wordCounts = {} }) {
  const [input, setInput] = useState('');
  const words = cleanWords(settings.hideWords);
  const set = (next) => setSettings({ ...settings, hideWords: cleanWords(next) });
  const add = () => {
    const t = input.trim();
    if (!t) return;
    set([...words, t]);
    setInput('');
  };
  return (
    <section className="busy-box">
      <h3>🙈 숨길 단어</h3>
      <p className="hint">
        센터 이름이나 프로그램 제목에 이 단어가 들어 있으면 목록·달력·센터 목록에서 빠져요. 띄어쓰기는 무시해요(&quot;서울형 키즈카페&quot;도 &quot;서울형키즈카페&quot;로 걸려요).
        숨긴 것은 옵션의 &quot;숨긴 것만 보기&quot;에서 볼 수 있고, 찜한 프로그램은 숨기지 않아요.
      </p>
      {words.length > 0 && (
        <div className="places-chips">
          {words.map((w) => (
            <span key={w} className="place-chip">
              {w}<small className="hw-n"> {wordCounts[w] ?? 0}개</small>
              <button type="button" aria-label={`${w} 지우기`} onClick={() => set(words.filter((x) => x !== w))}>✕</button>
            </span>
          ))}
        </div>
      )}
      {words.length < MAX_WORDS && (
        <div className="mc-input">
          <input
            value={input}
            maxLength={20}
            placeholder="예) 서울형키즈카페"
            aria-label="숨길 단어 입력"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button type="button" className="outline" onClick={add}>추가</button>
        </div>
      )}
    </section>
  );
}
