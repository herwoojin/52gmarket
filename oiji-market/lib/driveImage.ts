const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const _cache = new Map<string, string>();
const _inFlight = new Map<string, Promise<string>>();

const LS_PREFIX = "oiji-img-";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const MAX_CONCURRENT = 6;

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

function readLocalCache(id: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_PREFIX + id);
  } catch {
    return null;
  }
}

function writeLocalCache(id: string, dataUrl: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + id, dataUrl);
  } catch {
    // 용량 초과 등은 무시 — 이번 세션 메모리 캐시로만 동작
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Apps Script 동시 호출이 몰리면 타임아웃/오류가 잦아져 동시 실행 수를 제한
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot(): void {
  activeCount--;
  const next = waitQueue.shift();
  if (next) {
    activeCount++;
    next();
  }
}

async function fetchViaProxy(id: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await acquireSlot();
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=img&id=${id}`);
      const data = await res.json();
      if (data.ok && data.b64) {
        return `data:${data.mime};base64,${data.b64}`;
      }
    } catch {
      // 네트워크 오류 — 재시도
    } finally {
      releaseSlot();
    }
    if (attempt < MAX_RETRIES) await delay(RETRY_DELAY_MS * attempt);
  }
  return "";
}

/**
 * Drive URL을 Apps Script 프록시를 통해 base64 data URL로 변환.
 * CORS/CORP 이슈를 완전 우회. 메모리 + localStorage 이중 캐시로 재요청 방지,
 * 실패 시 자동 재시도, 동시 요청 수 제한으로 Apps Script 과부하 방지.
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

  const localHit = readLocalCache(id);
  if (localHit) {
    _cache.set(url, localHit);
    return localHit;
  }

  if (_inFlight.has(url)) return _inFlight.get(url)!;

  const promise = (async () => {
    const src = await fetchViaProxy(id);
    if (src) {
      _cache.set(url, src);
      writeLocalCache(id, src);
    }
    return src;
  })();

  _inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    _inFlight.delete(url);
  }
}
