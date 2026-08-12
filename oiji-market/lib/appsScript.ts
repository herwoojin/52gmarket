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
      lastErr = err;
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
