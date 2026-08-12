/**
 * 매물 목록 프록시 + 캐시
 *
 * Apps Script 는 요청 1건당 10~40초의 고정 오버헤드가 있어(시트 크기와 무관)
 * 브라우저가 직접 호출하면 매번 그 시간을 기다려야 한다.
 * 이 함수가 대신 호출해 Netlify CDN 에 캐시해두면, 사용자는 엣지에서
 * 즉시 응답을 받고 느린 호출은 백그라운드 재검증 때만 발생한다.
 */

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

// 같은 인스턴스가 살아있는 동안 유지되는 마지막 성공 응답.
// Apps Script 가 실패/타임아웃해도 빈 목록 대신 직전 값을 돌려주기 위한 안전망.
let lastGood = null;

export default async () => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    // 브라우저는 매번 CDN에 물어보고, CDN이 60초간 캐시를 제공한다.
    // stale-while-revalidate: 만료 후에도 일단 캐시를 즉시 주고 뒤에서 갱신.
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control":
      "public, s-maxage=60, stale-while-revalidate=600",
  };

  if (!APPS_SCRIPT_URL) {
    return new Response(
      JSON.stringify({ ok: false, error: "not_configured", items: [] }),
      { status: 500, headers }
    );
  }

  try {
    // Apps Script 가 간헐적으로 매우 느려 상한을 둔다.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(APPS_SCRIPT_URL, {
      redirect: "follow",
      signal: ctl.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    if (Array.isArray(data?.items)) {
      lastGood = data.items;
      return new Response(
        JSON.stringify({ ok: true, items: data.items, cached: false }),
        { status: 200, headers }
      );
    }
    throw new Error("unexpected payload");
  } catch (err) {
    if (lastGood) {
      return new Response(
        JSON.stringify({ ok: true, items: lastGood, stale: true }),
        { status: 200, headers }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, error: String(err), items: [] }),
      { status: 502, headers }
    );
  }
};

export const config = { path: "/api/items" };
