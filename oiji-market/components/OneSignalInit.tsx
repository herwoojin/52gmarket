"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/auth";
import { linkPushIdentity, isPushConfigured } from "@/lib/push";

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

export default function OneSignalInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (!isPushConfigured) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      await oneSignal.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: "/sw.js",
        serviceWorkerParam: { scope: "/" },
      });
    });
  }, []);

  // 로그인 상태가 바뀔 때마다 OneSignal external_id를 uid와 동기화
  useEffect(() => {
    if (!isPushConfigured) return;
    linkPushIdentity(user?.email || null);
  }, [user?.email]);

  if (!isPushConfigured) return null;

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
      defer
    />
  );
}
