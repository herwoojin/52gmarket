declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
export const isPushConfigured = !!ONESIGNAL_APP_ID;

const SDK_TIMEOUT_MS = 8000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOneSignal<T>(fn: (oneSignal: any) => T | Promise<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !isPushConfigured) return resolve(undefined);
    let settled = false;
    const settle = (value: T | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // SDK가 로드 실패하거나 init이 걸려도 버튼이 영원히 무반응 상태로 남지 않도록 타임아웃 처리
    setTimeout(() => settle(undefined), SDK_TIMEOUT_MS);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        settle(await fn(oneSignal));
      } catch (err) {
        console.error("[OneSignal]", err);
        settle(undefined);
      }
    });
  });
}

/** 로그인한 uid를 OneSignal external_id로 연결 — 서버에서 uid로 특정 유저에게 발송 가능해짐 */
export function linkPushIdentity(uid: string | null): void {
  withOneSignal(async (oneSignal) => {
    if (uid) await oneSignal.login(uid);
    else await oneSignal.logout();
  });
}

export async function requestPushPermission(): Promise<boolean> {
  const result = await withOneSignal(async (oneSignal) => {
    await oneSignal.Notifications.requestPermission();
    return !!oneSignal.Notifications.permission;
  });
  return !!result;
}

export async function isPushEnabled(): Promise<boolean> {
  const result = await withOneSignal(
    (oneSignal) => !!oneSignal.User?.PushSubscription?.optedIn
  );
  return !!result;
}
