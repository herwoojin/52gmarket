declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
export const isPushConfigured = !!ONESIGNAL_APP_ID;

const SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const OPTED_KEY = "oiji-push-opted";
const SDK_TIMEOUT_MS = 8000;

/** 이 기기에서 사용자가 직접 푸시를 켠 적이 있는지 */
export function hasOptedInPush(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(OPTED_KEY) === "true";
  } catch {
    return false;
  }
}

function markOptedIn(): void {
  try {
    localStorage.setItem(OPTED_KEY, "true");
  } catch {
    /* 무시 */
  }
}

let loadPromise: Promise<boolean> | null = null;

/**
 * OneSignal SDK 를 필요한 시점에만 로드한다.
 *
 * 페이지 진입만으로 로드하면 SDK 가 자체 구독 팝업(슬라이드다운)을 띄우는데,
 * 이 앱은 알림 페이지의 '푸시 알림 켜기' 버튼으로만 권한을 요청한다.
 * 따라서 사용자가 직접 켜기 전에는 SDK 를 아예 불러오지 않는다.
 */
export function ensureOneSignalLoaded(): Promise<boolean> {
  if (typeof window === "undefined" || !isPushConfigured) return Promise.resolve(false);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    setTimeout(() => settle(false), SDK_TIMEOUT_MS);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "sw.js",
          serviceWorkerParam: { scope: "/" },
          autoResubscribe: true,
          // 자동 팝업 비활성화 (대시보드 설정과 무관하게 이중으로 차단)
          promptOptions: { slidedown: { prompts: [{ type: "push", autoPrompt: false }] } },
          welcomeNotification: { disable: true },
        });
        settle(true);
      } catch (err) {
        console.error("[OneSignal] init 실패:", err);
        settle(false);
      }
    });

    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const el = document.createElement("script");
      el.src = SDK_SRC;
      el.defer = true;
      el.onerror = () => settle(false);
      document.head.appendChild(el);
    }
  });

  return loadPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOneSignal<T>(fn: (oneSignal: any) => T | Promise<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !isPushConfigured) return resolve(undefined);
    // SDK 가 로드되지 않은 상태(=사용자가 아직 켜지 않음)면 아무 일도 하지 않는다
    if (!loadPromise) return resolve(undefined);

    let settled = false;
    const settle = (value: T | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
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

/** 로그인한 uid를 OneSignal external_id로 연결 (SDK 가 로드된 경우에만) */
export function linkPushIdentity(uid: string | null): void {
  withOneSignal(async (oneSignal) => {
    if (uid) await oneSignal.login(uid);
    else await oneSignal.logout();
  });
}

/** 사용자가 '푸시 알림 켜기'를 눌렀을 때만 호출된다 */
export async function requestPushPermission(): Promise<boolean> {
  const loaded = await ensureOneSignalLoaded();
  if (!loaded) return false;

  const result = await withOneSignal(async (oneSignal) => {
    await oneSignal.Notifications.requestPermission();
    return !!oneSignal.Notifications.permission;
  });

  if (result) markOptedIn();
  return !!result;
}

export async function isPushEnabled(): Promise<boolean> {
  // 켠 적이 없으면 SDK 를 로드하지 않고 바로 false
  if (!hasOptedInPush()) return false;
  const result = await withOneSignal(
    (oneSignal) => !!oneSignal.User?.PushSubscription?.optedIn
  );
  return !!result;
}
