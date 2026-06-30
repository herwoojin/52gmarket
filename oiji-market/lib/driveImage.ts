const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const _cache = new Map<string, string>();

function normalize(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url === "이미지 보기" || url === "이미지링크") return "";
  if (url.includes("drive.google.com/thumbnail")) {
    const m = url.match(/id=([^&]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }
  return url;
}

function extractFileId(url: string): string | null {
  const m = url.match(/[?&]id=([^&\s]+)/);
  return m ? m[1] : null;
}

/**
 * Drive URL을 Apps Script 프록시를 통해 base64 data URL로 변환.
 * CORS/CORP 이슈를 완전 우회. 모듈 레벨 캐시로 재요청 방지.
 */
export async function loadDriveImg(rawUrl: string | undefined): Promise<string> {
  const url = normalize(rawUrl);
  if (!url) return "";
  if (_cache.has(url)) return _cache.get(url)!;

  if (!url.includes("drive.google.com")) {
    _cache.set(url, url);
    return url;
  }

  const id = extractFileId(url);
  if (!id || !APPS_SCRIPT_URL) return "";

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=img&id=${id}`);
    const data = await res.json();
    if (!data.ok || !data.b64) return "";
    const src = `data:${data.mime};base64,${data.b64}`;
    _cache.set(url, src);
    return src;
  } catch {
    return "";
  }
}
