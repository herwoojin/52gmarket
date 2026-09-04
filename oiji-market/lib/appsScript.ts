/**
 * Apps Script 호출 공통 래퍼.
 *
 * Apps Script 는 스크립트가 정상 실행됐는데도 결과를 받아오는 단계에서
 * 간헐적으로 404 를 반환한다(실측 5회 중 2회). 일시적 실패이므로
 * 짧은 백오프로 재시도하면 대부분 성공한다.
 */

const RETRY_DELAYS_MS = [600, 1500, 3000];

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 서버에 아예 닿지 못한 경우.
 *
 * 브라우저는 CORS 로 막힌 응답의 상태 코드를 자바스크립트에 알려주지 않고
 * TypeError 만 던진다. 그래서 '인터넷이 끊긴 것'과 '앱스크립트 배포가
 * 비공개라 403 이 온 것'이 코드 상으로는 똑같이 보인다.
 * 후자는 사용자가 재시도해도 절대 풀리지 않으므로 따로 구분해 둔다.
 */
export class AppsScriptUnreachableError extends Error {
  constructor() {
    super("apps script unreachable");
    this.name = "AppsScriptUnreachableError";
  }
}

/** 사용자에게 보여줄 안내 문구 */
export function describeAppsScriptError(err: unknown): string {
  if (err instanceof AppsScriptUnreachableError) {
    return navigator.onLine
      ? "서버에 연결할 수 없어요. 잠시 후 다시 시도하거나 관리자에게 알려주세요."
      : "인터넷 연결을 확인해주세요.";
  }
  return "잠시 후 다시 시도해주세요.";
}

export async function fetchAppsScript(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init);
      // 404/5xx 는 Apps Script 의 일시적 오류일 가능성이 높아 재시도 대상
      if (res.ok) return res;
      if (res.status !== 404 && res.status < 500) return res; // 그 외 상태는 그대로 반환
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      // fetch 가 던지는 TypeError = 네트워크 단절 또는 CORS 차단
      lastErr = err instanceof TypeError ? new AppsScriptUnreachableError() : err;
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastErr ?? new Error("apps script request failed");
}

/** JSON 응답까지 받아오는 헬퍼 */
export async function fetchAppsScriptJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetchAppsScript(url, init);
  return (await res.json()) as T;
}
