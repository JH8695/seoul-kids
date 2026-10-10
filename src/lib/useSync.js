import { useCallback, useEffect, useRef, useState } from 'react';
import { loadBackend } from './firebase';
import { pickSync, reconcile, signature } from './sync';

const FLAG = 'seoulkids:sync'; // 로그인한 적이 있으면 다음에 열 때 자동으로 이어서 동기화
const readFlag = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };
const setFlag = (on) => { try { localStorage.setItem(FLAG, on ? '1' : '0'); } catch { /* ignore */ } };

const explain = (e) => {
  const code = e?.code ?? '';
  if (code === 'auth/popup-blocked') return '팝업이 막혔어요. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.';
  if (code === 'auth/unauthorized-domain') return '이 주소가 Firebase "승인된 도메인"에 없어요. Authentication → 설정 → 승인된 도메인에 추가해 주세요.';
  if (code === 'auth/operation-not-allowed') return 'Firebase에서 Google 로그인이 켜져 있지 않아요.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return '서버가 저장을 거절했어요. Firestore 규칙을 확인해 주세요.';
  if (code === 'auth/network-request-failed' || code === 'unavailable' || code === 'firestore/unavailable') return '인터넷 연결을 확인해 주세요.';
  return e?.message ? `동기화 오류: ${e.message}` : '동기화 중 문제가 생겼어요.';
};
const isOffline = (e) => ['unavailable', 'firestore/unavailable', 'auth/network-request-failed'].includes(e?.code) || (typeof navigator !== 'undefined' && navigator.onLine === false);

/**
 * 구글 로그인 + Firestore 동기화.
 * phase: off(안 씀) | loading | signedOut | syncing | ok | offline | error
 */
export function useSync(settings, applyRemote) {
  const [state, setState] = useState({ phase: readFlag() ? 'loading' : 'off', user: null, last: null, error: '' });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const backendRef = useRef(null);
  const userRef = useRef(null);
  const unwatchRef = useRef(null);
  const lastSig = useRef('');
  const timer = useRef(null);
  const retry = useRef(null);
  const running = useRef(false);
  const again = useRef(false);
  const authBound = useRef(false);

  const patch = (p) => setState((s) => ({ ...s, ...p }));

  const syncOnce = useCallback(async () => {
    const backend = backendRef.current;
    const user = userRef.current;
    if (!backend || !user) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    patch({ phase: 'syncing', error: '' });
    try {
      const res = await backend.transact(user.uid, (remote) => {
        const cur = settingsRef.current;
        const r = reconcile(cur, remote, { firstLink: cur._linked !== user.uid });
        return { ...r, data: r.values, write: r.remoteChanged };
      });
      lastSig.current = signature(res.data, res.stamps);
      if (res.localChanged || settingsRef.current._linked !== user.uid) applyRemote(res.values, res.stamps, user.uid);
      patch({ phase: 'ok', last: Date.now(), error: '' });
    } catch (e) {
      if (isOffline(e)) {
        patch({ phase: 'offline', error: '' });
        clearTimeout(retry.current);
        retry.current = setTimeout(() => syncOnce(), 20000);
      } else {
        patch({ phase: 'error', error: explain(e) });
      }
    } finally {
      running.current = false;
      if (again.current) { again.current = false; syncOnce(); }
    }
  }, [applyRemote]);

  const schedule = useCallback(
    (ms) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => syncOnce(), ms);
    },
    [syncOnce],
  );

  const startWatch = useCallback(
    (backend, user) => {
      unwatchRef.current?.();
      unwatchRef.current = backend.watch(
        user.uid,
        (remote, pending) => {
          if (pending) return; // 내가 방금 쓴 것의 임시 알림
          const sig = remote ? signature(remote.data, remote.stamps) : '';
          if (sig === lastSig.current) return; // 이미 반영한 내용
          schedule(0);
        },
        (e) => patch({ phase: 'error', error: explain(e) }),
      );
    },
    [schedule],
  );

  const bind = useCallback(
    async () => {
      const backend = backendRef.current ?? (await loadBackend());
      backendRef.current = backend;
      if (authBound.current) return backend;
      authBound.current = true;
      backend.onAuth((user) => {
        userRef.current = user;
        if (!user) {
          unwatchRef.current?.();
          unwatchRef.current = null;
          patch({ phase: 'signedOut', user: null });
          return;
        }
        patch({ user, phase: 'syncing' });
        startWatch(backend, user);
        schedule(0);
      });
      return backend;
    },
    [schedule, startWatch],
  );

  // 이전에 로그인한 적이 있으면 열 때 자동으로 이어서
  useEffect(() => {
    if (!readFlag()) return undefined;
    bind().catch((e) => patch({ phase: 'error', error: explain(e) }));
    return () => { clearTimeout(timer.current); clearTimeout(retry.current); unwatchRef.current?.(); };
  }, [bind]);

  // 내 기기에서 고친 내용을 서버로 (잠깐 모았다가)
  const localSig = signature(pickSync(settings), settings._stamps ?? {});
  useEffect(() => {
    if (!userRef.current || state.phase === 'off' || state.phase === 'loading' || state.phase === 'signedOut') return;
    if (localSig === lastSig.current) return;
    schedule(1200);
  }, [localSig, schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => { if (userRef.current) schedule(0); };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [schedule]);

  const signIn = useCallback(async () => {
    patch({ phase: 'loading', error: '' });
    try {
      const backend = await bind();
      setFlag(true);
      await backend.signIn();
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        patch({ phase: userRef.current ? 'ok' : 'signedOut' });
        return;
      }
      patch({ phase: 'error', error: explain(e) });
    }
  }, [bind]);

  const signOut = useCallback(async () => {
    try { await backendRef.current?.signOut(); } catch { /* ignore */ }
    setFlag(false);
    unwatchRef.current?.();
    unwatchRef.current = null;
    userRef.current = null;
    lastSig.current = '';
    patch({ phase: 'off', user: null, error: '' });
  }, []);

  return { ...state, signIn, signOut, syncNow: () => schedule(0), enabled: state.phase !== 'off' };
}
