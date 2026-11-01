import { cleanPlaces, listPlaces, withPlace } from '../lib/places';

// 설정 창: 관심(★)·제외(✕) 장소 목록. 해제는 여기서, 정하는 건 카드의 장소 이름을 눌러서.
export default function PlacesList({ settings, setSettings }) {
  const places = cleanPlaces(settings.places);
  const fav = listPlaces(places, 'fav');
  const hide = listPlaces(places, 'hide');
  const clear = (key) => setSettings({ ...settings, places: withPlace(places, key, '', null) });
  const group = (title, list) =>
    list.length > 0 && (
      <div className="places-group">
        <strong>{title} {list.length}</strong>
        <div className="places-chips">
          {list.map((p) => (
            <span key={p.key} className="place-chip">
              {p.name}
              <button type="button" aria-label={`${p.name} 해제`} onClick={() => clear(p.key)}>✕</button>
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <section className="busy-box">
      <h3>📍 관심·제외 장소</h3>
      {fav.length + hide.length === 0 ? (
        <p className="hint">프로그램 카드의 <strong>장소 이름</strong>을 누르면 ★ 관심 장소나 ✕ 제외 장소로 정할 수 있어요. 제외한 장소의 프로그램은 목록과 달력에서 빠지고(찜한 것은 제외), 관심 장소는 위쪽 &quot;★ 장소&quot; 버튼으로 모아 볼 수 있어요.</p>
      ) : (
        <>
          {group('★ 관심 장소', fav)}
          {group('✕ 제외 장소', hide)}
        </>
      )}
    </section>
  );
}
