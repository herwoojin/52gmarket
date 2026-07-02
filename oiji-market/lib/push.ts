declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
export const isPushConfigured = !!ONESIGNAL_APP_ID;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOneSignal<T>(fn: (oneSignal: any) => T | Promise<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !isPushConfigured) return resolve(undefined);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      resolve(await fn(oneSignal));
    });
  });
}

/** 로그인한 uid를 OneSignal external_id로 연결 — 서버에서 uid로 특정 유저에게 발송 가능해짐 */
export function linkPushIdentity(uid: string | null): void {
  withOneSignal((oneSignal) => {
    if (uid) oneSignal.login(uid);
    else oneSignal.logout();
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
