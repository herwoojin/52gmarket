/**
 * 매물 사진 프록시 + CDN 캐시
 *
 * 기존에는 브라우저가 이미지마다 Apps Script 를 호출해 base64 JSON 을 받고
 * data URL 로 변환했다(장당 2초 이상, 사용자마다 매번 반복).
 *
 * 이 함수가 대신 받아 실제 이미지 바이트로 돌려주면
 *  - 브라우저가 <img src> 로 바로 로드 (JS 개입·base64 디코딩 없음)
 *  - Netlify CDN 이 캐시하므로 첫 요청 이후 전 사용자가 즉시 응답
 *  - 브라우저 자체 캐시도 동작
 * Drive 파일 id 는 불변이라 오래 캐시해도 안전하다.
 */

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !APPS_SCRIPT_URL) {
    return new Response("bad request", { status: 400 });
  }

  // Apps Script 는 간헐적으로 404 를 반환하므로 짧게 재시도한다.
  for (const wait of [0, 700, 1800]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(
        `${APPS_SCRIPT_URL}?action=img&id=${encodeURIComponent(id)}`,
        { redirect: "follow", signal: ctl.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data?.ok || !data?.b64) continue;

      const bytes = Buffer.from(data.b64, "base64");
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": data.mime || "image/webp",
          "Access-Control-Allow-Origin": "*",
          // 파일 id 가 바뀌면 URL 도 바뀌므로 영구 캐시로 둔다
          "Cache-Control": "public, max-age=31536000, immutable",
          "Netlify-CDN-Cache-Control":
            "public, s-maxage=31536000, stale-while-revalidate=86400",
        },
      });
    } catch {
      // 다음 시도로
    }
  }

  return new Response("upstream failed", { status: 502 });
};

export const config = { path: "/api/img" };
