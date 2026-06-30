"use client";

import { useAuth } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** 미인증 시 /login으로 리다이렉트. /login 페이지에서는 가드하지 않음. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  // 로딩 중
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-skin-0">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cuke border-t-transparent" />
          <p className="text-[13px] text-muted">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 페이지는 그대로 통과
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 미인증이면 아무것도 렌더링하지 않음 (리다이렉트 대기)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
