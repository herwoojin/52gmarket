"use client";

import { useState, useEffect } from "react";
import BottomTab from "@/components/BottomTab";
import { useNotifications } from "@/lib/notifications";
import { useQuery } from "@tanstack/react-query";
import { fetchSellerChats, fetchChatReads, countUnreadRooms } from "@/lib/chat";
import { useAuth } from "@/lib/auth";

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

  const { data: sellerRooms = [] } = useQuery({
    queryKey: ["sellerChats", user?.email],
    queryFn: () => fetchSellerChats(user?.email || ""),
    enabled: !!user?.email && ready,
    refetchInterval: 180_000,
    staleTime: 0,
  });

  const { data: reads = {} } = useQuery({
    queryKey: ["chatReads", user?.email],
    queryFn: () => fetchChatReads(user?.email || ""),
    enabled: !!user?.email && ready,
    refetchInterval: 180_000,
    staleTime: 0,
  });

  return <BottomTab notiBadge={unreadCount} chatBadge={countUnreadRooms(sellerRooms, reads)} />;
}
