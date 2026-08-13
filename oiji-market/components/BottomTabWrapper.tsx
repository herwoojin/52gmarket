"use client";

import { useState, useEffect } from "react";
import BottomTab from "@/components/BottomTab";
import { useNotifications } from "@/lib/notifications";
import { useQuery } from "@tanstack/react-query";
import { fetchSellerChats, fetchChatReads, countUnreadRooms } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { subscribeMyRooms } from "@/lib/chatFirestore";
import { isFirebaseEnabled } from "@/lib/firebase";
import type { SellerChatRoom } from "@/lib/chat";

export default function BottomTabWrapper() {
  const { unreadCount } = useNotifications();
  const { user } = useAuth();

  // 채팅 배지는 부가 정보라 화면의 핵심 데이터(매물)보다 뒤로 미룬다.
  // Apps Script 동시 실행 슬롯을 두고 경쟁하면 본문 로딩이 그만큼 느려짐.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(t);
  }, []);

  // Firebase 사용 시 실시간 구독 — 폴링이 없어 지연도 서버 부하도 없다
  const [fsRooms, setFsRooms] = useState<SellerChatRoom[]>([]);

  useEffect(() => {
    if (!isFirebaseEnabled || !user?.email) return;
    const u1 = subscribeMyRooms(user.email, setFsRooms);
    return () => { if (u1) u1(); };
  }, [user?.email]);

  const { data: polledRooms = [] } = useQuery({
    queryKey: ["sellerChats", user?.email],
    queryFn: () => fetchSellerChats(user?.email || ""),
    enabled: !!user?.email && ready && !isFirebaseEnabled,
    refetchInterval: 180_000,
    staleTime: 0,
  });

  const { data: polledReads = {} } = useQuery({
    queryKey: ["chatReads", user?.email],
    queryFn: () => fetchChatReads(user?.email || ""),
    enabled: !!user?.email && ready && !isFirebaseEnabled,
    refetchInterval: 180_000,
    staleTime: 0,
  });

  const sellerRooms = isFirebaseEnabled ? fsRooms : polledRooms;
  const reads = isFirebaseEnabled ? {} : polledReads;

  return <BottomTab notiBadge={unreadCount} chatBadge={countUnreadRooms(sellerRooms, reads, user?.email || "")} />;
}
