"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isFirebaseEnabled } from "@/lib/firebase";
import { subscribeMyRooms } from "@/lib/chatFirestore";
import { myLastReadOf } from "@/lib/chat";

/**
 * 앱을 켜둔 상태에서 새 메시지가 오면 알려준다.
 *
 * 중복 알림 방지:
 *  - 이미 읽은 대화(내 읽음 시각 이후 메시지가 없음)는 알리지 않는다
 *  - 같은 메시지에 대해 한 번만 알린다(방별 마지막 알림 시각을 기억)
 *  - 첫 구독 응답은 '기존 상태'이므로 기준점만 잡고 알리지 않는다
 *  - 채팅 목록 화면을 보고 있을 때는 화면에 이미 보이므로 알리지 않는다
 */
export default function ChatWatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const primed = useRef(false);
  const notifiedAt = useRef<Record<string, number>>({});
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!isFirebaseEnabled || !user?.email) return;
    const me = user.email;

    primed.current = false;
    notifiedAt.current = {};

    const unsub = subscribeMyRooms(me, (rooms) => {
      // 첫 응답은 기준점만 잡는다 (앱을 켜자마자 과거 메시지로 알림이 쏟아지지 않도록)
      if (!primed.current) {
        primed.current = true;
        rooms.forEach((r) => {
          notifiedAt.current[r.roomId] = r.lastAt;
        });
        return;
      }

      rooms.forEach((r) => {
        if (!r.lastAt) return;
        if (r.lastSenderUid === me) return;          // 내가 보낸 건 제외
        if (r.lastAt <= myLastReadOf(r, me)) return; // 이미 읽은 대화는 제외
        if (r.lastAt <= (notifiedAt.current[r.roomId] ?? 0)) return; // 같은 메시지 재알림 방지

        notifiedAt.current[r.roomId] = r.lastAt;

        // 채팅 목록에 있으면 화면에 이미 보이므로 굳이 알리지 않는다
        if (pathRef.current === "/chats") return;

        toast(`💬 @${r.buyerNick || "새 메시지"}`, {
          description: r.lastMsg,
          duration: 6000,
          action: {
            label: "보기",
            onClick: () => router.push("/chats"),
          },
        });
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, [user?.email, router]);

  return null;
}
