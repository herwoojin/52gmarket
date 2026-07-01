"use client";

import BottomTab from "@/components/BottomTab";
import { useNotifications } from "@/lib/notifications";
import { useQuery } from "@tanstack/react-query";
import { fetchSellerChats } from "@/lib/chat";
import { useAuth } from "@/lib/auth";

export default function BottomTabWrapper() {
  const { unreadCount } = useNotifications();
  const { user } = useAuth();

  const { data: sellerRooms = [] } = useQuery({
    queryKey: ["sellerChats", user?.email],
    queryFn: () => fetchSellerChats(user?.email || ""),
    enabled: !!user?.email,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  return <BottomTab notiBadge={unreadCount} chatBadge={sellerRooms.length} />;
}
