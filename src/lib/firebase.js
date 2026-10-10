// Firebase 와 통신하는 부분만 따로 모아 둔 어댑터. 로그인하기 전에는 아예 불러오지 않아요
// (처음 화면이 가볍게 열리도록 동적 import). 시험할 때는 가짜 백엔드를 끼워 넣을 수 있어요.
import { firebaseConfig } from '../data/firebase';

let cached = null;

export function loadBackend() {
  if (globalThis.__SEOULKIDS_FAKE_BACKEND__) return Promise.resolve(globalThis.__SEOULKIDS_FAKE_BACKEND__);
  if (!cached) {
    cached = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(
      ([appMod, authMod, fsMod]) => {
        const app = appMod.initializeApp(firebaseConfig);
        const auth = authMod.getAuth(app);
        const db = fsMod.getFirestore(app);
        const docRef = (uid) => fsMod.doc(db, 'users', uid);
        const userOf = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName } : null);
        return {
          onAuth: (cb) => authMod.onAuthStateChanged(auth, (u) => cb(userOf(u))),
          signIn: () => authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()),
          signOut: () => authMod.signOut(auth),
          // 서버 문서가 바뀔 때마다 알려줌 (내가 쓴 직후의 임시 알림은 pending=true)
          watch: (uid, cb, onError) =>
            fsMod.onSnapshot(docRef(uid), (snap) => cb(snap.exists() ? snap.data() : null, snap.metadata.hasPendingWrites), onError),
          // 읽고 → 합치고 → 쓰기를 한 번에(다른 기기와 동시에 써도 안전). fn(remote) 가 { write, data, stamps, ... } 를 돌려줌
          transact: (uid, fn) =>
            fsMod.runTransaction(db, async (tx) => {
              const ref = docRef(uid);
              const snap = await tx.get(ref);
              const res = fn(snap.exists() ? snap.data() : null);
              if (res.write) tx.set(ref, { data: res.data, stamps: res.stamps, updatedAt: fsMod.serverTimestamp() });
              return res;
            }),
        };
      },
    );
  }
  return cached;
}
