/** 매물 1건당 최대 사진 수 */
export const MAX_PHOTOS = 3;

/**
 * photoURL 필드는 사진 여러 장을 쉼표로 이어 저장한다.
 * (Drive URL에는 쉼표가 없어 안전하며, 기존 1장짜리 값도 그대로 동작)
 */
export function parsePhotoUrls(photoURL: string | undefined): string[] {
  if (!photoURL) return [];
  return photoURL
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
}

/** 사진 URL 배열을 저장용 문자열로 합친다 */
export function joinPhotoUrls(urls: string[]): string {
  return urls.filter(Boolean).slice(0, MAX_PHOTOS).join(",");
}

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
 * 표시할 이미지 주소를 반환한다.
 *
 * Drive 사진은 /api/img 프록시를 거친다. 이 함수는 네트워크 요청 없이
 * 주소만 즉시 만들어 주고, 실제 다운로드는 브라우저가 <img> 로 처리한다.
 * (이전에는 이미지마다 fetch → base64 → data URL 변환을 거쳐 느렸다)
 */
export function getImgSrc(rawUrl: string | undefined): string {
  const url = normalize(rawUrl);
  if (!url) return "";
  if (!url.includes("drive.google.com")) return url;
  const id = extractFileId(url);
  return id ? `/api/img?id=${encodeURIComponent(id)}` : "";
}

/** 기존 호출부 호환용 — 즉시 주소를 돌려준다 */
export async function loadDriveImg(rawUrl: string | undefined): Promise<string> {
  return getImgSrc(rawUrl);
}
