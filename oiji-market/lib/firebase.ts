import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithCustomToken, type Auth } from "firebase/auth";
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

/**
 * OTP 인증 후 앱스크립트가 발급한 커스텀 토큰으로 Firebase 로그인.
 * 이후 Firestore 보안 규칙이 request.auth.uid 로 본인 여부를 검증한다.
 */
export async function signInToFirebase(customToken: string): Promise<boolean> {
  if (!auth || !customToken) return false;
  try {
    await signInWithCustomToken(auth, customToken);
    localStorage.setItem(TOKEN_KEY, customToken);
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
  try {
    await signInWithCustomToken(auth, token);
    return true;
  } catch {
    // 만료된 토큰 — 재로그인이 필요하다
    localStorage.removeItem(TOKEN_KEY);
    return false;
  }
}

export function clearFirebaseSession(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  auth?.signOut().catch(() => {});
}

export { app, auth, storage, db };
