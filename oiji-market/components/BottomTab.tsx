"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, MessageCircle, Plus, Bell, User } from "lucide-react";

interface TabItem {
  href: string;
  label: string;
  icon: typeof Home;
  fab?: boolean;
}

const tabs: TabItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/chats", label: "채팅", icon: MessageCircle },
  { href: "/upload", label: "올리기", icon: Plus, fab: true },
  { href: "/noti", label: "알림", icon: Bell },
  { href: "/me", label: "내정보", icon: User },
];

interface BottomTabProps {
  notiBadge?: number;
  chatBadge?: number;
}

export default function BottomTab({ notiBadge = 0, chatBadge = 0 }: BottomTabProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div
        className="w-full max-w-[920px] flex items-end justify-around border-t border-skin-line bg-skin-0/95 backdrop-blur-xl"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;

          if (tab.fab) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative -mt-5 flex flex-col items-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cuke shadow-lg shadow-cuke/30 transition-transform active:scale-95">
                  <Icon size={26} className="text-skin-0" strokeWidth={2.5} />
                </div>
                <span className="mt-1 text-[10px] font-bold text-cuke">
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 pt-2.5 pb-1 transition-colors ${
                active ? "text-cuke" : "text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>
                {tab.label}
              </span>
              {/* 알림 배지 */}
              {tab.label === "알림" && notiBadge > 0 && (
                <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {notiBadge > 99 ? "99+" : notiBadge}
                </span>
              )}
              {/* 채팅 배지 */}
              {tab.label === "채팅" && chatBadge > 0 && (
                <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {chatBadge > 99 ? "99+" : chatBadge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
