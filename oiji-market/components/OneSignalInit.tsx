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
      try {
        await oneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "sw.js",
          serviceWorkerParam: { scope: "/" },
          // 자동 구독 팝업 비활성화 — 알림 페이지의 '푸시 알림 켜기' 버튼으로만 요청한다
          autoResubscribe: true,
          promptOptions: {
            slidedown: {
              prompts: [{ type: "push", autoPrompt: false }],
            },
          },
          welcomeNotification: { disable: true },
        });
      } catch (err) {
        // OneSignal 대시보드에서 Web Push 플랫폼 설정이 안 끝났을 때 등 init 자체가 실패할 수 있음
        console.error("[OneSignal] init 실패:", err);
      }
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
