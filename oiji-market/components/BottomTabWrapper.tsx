"use client";

import BottomTab from "@/components/BottomTab";
import { useNotifications } from "@/lib/notifications";

export default function BottomTabWrapper() {
  const { unreadCount } = useNotifications();
  return <BottomTab notiBadge={unreadCount} />;
}
