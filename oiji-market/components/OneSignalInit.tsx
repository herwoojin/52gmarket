"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  ensureOneSignalLoaded,
  hasOptedInPush,
  linkPushIdentity,
  isPushConfigured,
} from "@/lib/push";

/**
 * OneSignal SDK 는 페이지 진입만으로 로드하지 않는다.
 * 로드하는 순간 SDK 가 자체 구독 팝업을 띄우기 때문이다.
 * 이미 이 기기에서 푸시를 켜둔 사용자에 한해서만 로드해
 * 구독 상태와 로그인 계정(external_id)을 유지한다.
 */
export default function OneSignalInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (!isPushConfigured || !hasOptedInPush()) return;
    ensureOneSignalLoaded();
  }, []);

  useEffect(() => {
    if (!isPushConfigured || !hasOptedInPush()) return;
    linkPushIdentity(user?.email || null);
  }, [user?.email]);

  return null;
}
