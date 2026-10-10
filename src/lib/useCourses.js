import { useEffect, useState } from 'react';
import sample from '../data/sampleCourses.json';

// public/data/courses.json 이 있으면 실데이터, 없으면 샘플(실제 예약 목록 10건)을 사용합니다.
// courses.json 형태: { meta: { fetchedAt, errors: [{source, message}] }, courses: [...] }
export function useCourses() {
  const [state, setState] = useState({ courses: sample.courses, meta: sample.meta, loading: true });

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/courses.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no file'))))
      .then((json) => {
        if (!alive || !Array.isArray(json.courses)) throw new Error('bad format');
        setState({ courses: json.courses, meta: { isSample: false, ...json.meta }, loading: false });
      })
      .catch(() => alive && setState({ courses: sample.courses, meta: sample.meta, loading: false }));
    return () => { alive = false; };
  }, []);

  return state;
}
