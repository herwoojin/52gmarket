"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface UserProfile {
  email: string;
  nick: string;
  loc: string;      // 근무지(픽업 위치)
  dept: string;     // 소속(부서)
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
  updateProfile: (p: Partial<UserProfile>) => void;
}

const STORAGE_KEY = "oiji-auth";

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
  updateProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 localStorage에서 세션 복원
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // 무시
    }
    setLoading(false);
  }, []);

  const signIn = useCallback((email: string) => {
    const profile: UserProfile = {
      email,
      nick: email.split("@")[0],
      loc: "본사 3층",
      dept: "",
    };
    // 기존 프로필이 있으면 유지
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prev = JSON.parse(stored);
        if (prev.email === email) {
          profile.nick = prev.nick || profile.nick;
          profile.loc = prev.loc || profile.loc;
          profile.dept = prev.dept || "";
        }
      }
    } catch { /* 무시 */ }

    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
