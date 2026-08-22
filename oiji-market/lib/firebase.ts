import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

/** 환경변수가 비어있으면 Firebase 미사용 (기존 Apps Script 경로로 폴백) */
export const isFirebaseEnabled = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

/**
 * Firebase Storage 는 신규 프로젝트에서 Blaze(종량제) 플랜을 요구한다.
 * 무료(Spark) 플랜에서는 사진을 기존처럼 Apps Script → Google Drive 로 올린다.
 * 나중에 요금제를 올리면 NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true 로 켤 수 있다.
 */
export const isFirebaseStorageEnabled =
  isFirebaseEnabled && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED === "true";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let db: Firestore | null = null;

if (isFirebaseEnabled) {
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
  db = getFirestore(app);
}

const TOKEN_KEY = "oiji-fb-token";
const TOKEN_AT_KEY = "oiji-fb-token-at";
/** 커스텀 토큰 유효시간은 1시간. 여유를 두고 50분까지만 재사용한다 */
const TOKEN_MAX_AGE_MS = 50 * 60 * 1000;

let authReadyPromise: Promise<boolean> | null = null;

/**
 * Firebase 인증이 확정될 때까지 기다린다.
 *
 * 구독을 인증보다 먼저 걸면 보안 규칙에 막혀 실패하거나 빈 결과를 받는다.
 * 첫 인증 상태 이벤트를 기다리고, 로그인돼 있지 않으면 저장된 토큰으로
 * 복원을 한 번 시도한 뒤 결과를 알려준다.
 */
export function ensureFirebaseAuth(): Promise<boolean> {
  if (!auth) return Promise.resolve(false);
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise<boolean>((resolve) => {
    const unsub = onAuthStateChanged(auth!, async (u) => {
      unsub();
      if (u) return resolve(true);
      resolve(await restoreFirebaseSession());
    });
  });
  return authReadyPromise;
}

/**
 * OTP 인증 후 앱스크립트가 발급한 커스텀 토큰으로 Firebase 로그인.
 * 이후 Firestore 보안 규칙이 request.auth.uid 로 본인 여부를 검증한다.
 */
export async function signInToFirebase(customToken: string): Promise<boolean> {
  if (!auth || !customToken) return false;
  try {
    await signInWithCustomToken(auth, customToken);
    localStorage.setItem(TOKEN_KEY, customToken);
    localStorage.setItem(TOKEN_AT_KEY, String(Date.now()));
    return true;
  } catch (err) {
    console.error("[Firebase] 커스텀 토큰 로그인 실패:", err);
    return false;
  }
}

/** 새로고침 등으로 세션이 끊겼을 때 저장해둔 토큰으로 재로그인 시도 */
export async function restoreFirebaseSession(): Promise<boolean> {
  if (!auth) return false;
  if (auth.currentUser) return true;
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return false;

  // 만료된 토큰으로 로그인하면 400 이 떨어진다. 오래됐으면 쓰지 않는다.
  const issuedAt = Number(localStorage.getItem(TOKEN_AT_KEY) || 0);
  if (!issuedAt || Date.now() - issuedAt > TOKEN_MAX_AGE_MS) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_AT_KEY);
    return false;
  }
  try {
    await signInWithCustomToken(auth, token);
    return true;
  } catch {
    // 만료된 토큰 — 재로그인이 필요하다
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_AT_KEY);
    return false;
  }
}

export function clearFirebaseSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_AT_KEY);
  }
  auth?.signOut().catch(() => {});
}

export { app, auth, storage, db };
