"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { isDemoMode } from "@/lib/firebase";
import type { UserProfile } from "@/types";

interface AuthState {
  user: User | null;
  profile: UserProfile;
  loading: boolean;
  isDemoMode: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (p: Partial<UserProfile>) => void;
}

const defaultProfile: UserProfile = { nick: "오이박사", loc: "본사 3층" };

const AuthContext = createContext<AuthState>({
  user: null,
  profile: defaultProfile,
  loading: true,
  isDemoMode: true,
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    (async () => {
      const { auth } = await import("@/lib/firebase");
      const { onAuthStateChanged } = await import("firebase/auth");
      if (!auth) return;

      unsubscribe = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          // Firestore에서 프로필 로드
          try {
            const { db } = await import("@/lib/firebase");
            const { doc, getDoc } = await import("firebase/firestore");
            if (db) {
              const snap = await getDoc(doc(db, "users", u.uid));
              if (snap.exists()) {
                setProfile(snap.data() as UserProfile);
              } else {
                // 최초 로그인: 기본 프로필 설정
                const newProfile = {
                  nick: u.displayName || "오이박사",
                  loc: "본사 3층",
                };
                setProfile(newProfile);
              }
            }
          } catch {
            setProfile({ nick: u.displayName || "오이박사", loc: "본사 3층" });
          }
        }
        setLoading(false);
      });
    })();

    return () => unsubscribe?.();
  }, []);

  const signIn = async () => {
    if (isDemoMode) return;
    const { auth } = await import("@/lib/firebase");
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    if (!auth) return;
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signOutFn = async () => {
    if (isDemoMode) return;
    const { auth } = await import("@/lib/firebase");
    const { signOut: fbSignOut } = await import("firebase/auth");
    if (!auth) return;
    await fbSignOut(auth);
  };

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));

    // Firestore에 저장 (비동기, 에러 무시)
    if (!isDemoMode && user) {
      (async () => {
        try {
          const { db } = await import("@/lib/firebase");
          const { doc, setDoc } = await import("firebase/firestore");
          if (db) {
            await setDoc(doc(db, "users", user.uid), { ...profile, ...patch }, { merge: true });
          }
        } catch (e) {
          console.error("프로필 저장 실패", e);
        }
      })();
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isDemoMode, signIn, signOut: signOutFn, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
