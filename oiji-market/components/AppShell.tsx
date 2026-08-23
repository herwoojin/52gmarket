"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";
import BottomTabWrapper from "@/components/BottomTabWrapper";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isLoginPage = pathname === "/login";

  const handleLogout = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <AuthGuard>
      {!isLoginPage && (
        /* 헤더 */
        <header className="sticky top-0 z-40 border-b border-skin-line bg-skin-0/95 backdrop-blur-xl">
          <div
            className="mx-auto flex max-w-[920px] items-center gap-3 px-4"
            style={{
              paddingTop: "max(env(safe-area-inset-top), 14px)",
              paddingBottom: "12px",
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cuke text-xl">
              🥒
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">
                오이<span className="text-cuke-bright">(52)</span>지마켓
              </h1>
              <p className="text-[11.5px] text-muted">사내 나눔·재판매 마켓</p>
            </div>
            <Link
              href="/upload"
              className="ml-auto flex items-center gap-1.5 rounded-2xl bg-cuke px-4 py-2 text-[13px] font-extrabold text-skin-0 shadow-md shadow-cuke/30 transition-transform active:scale-95"
            >
              <Plus size={16} strokeWidth={2.5} />
              올리기
            </Link>
            {/* 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-skin-line bg-skin-1 text-muted transition-colors hover:border-cuke hover:text-cuke active:scale-95"
            >
              {user?.nick ? (
                <span className="text-[13px] font-bold leading-none">{user.nick.charAt(0).toUpperCase()}</span>
              ) : (
                <LogOut size={15} />
              )}
            </button>
          </div>
        </header>
      )}

      {/* 메인 콘텐츠 */}
      {isLoginPage ? (
        children
      ) : (
        <main className="mx-auto w-full max-w-[920px] flex-1 pb-24">
          {children}
        </main>
      )}

      {/* 하단 탭 */}
      {!isLoginPage && <BottomTabWrapper />}
    </AuthGuard>
  );
}
