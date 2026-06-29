"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Notification } from "@/types";

interface NotiState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (noti: Notification) => void;
  markAllRead: () => void;
}

const NotiContext = createContext<NotiState>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((noti: Notification) => {
    setNotifications((prev) => [noti, ...prev]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotiContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead }}>
      {children}
    </NotiContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotiContext);
}
