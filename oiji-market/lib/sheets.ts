import type { Product, NewProduct } from "@/types";
import { DEMO_PRODUCTS } from "./demo-data";
import { fetchAppsScript } from "./appsScript";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_OIJI_API_TOKEN || "";

const isDemoMode = !APPS_SCRIPT_URL;

// POST 헬퍼 — Content-Type text/plain 으로 프리플라이트 회피
async function post(payload: object) {
  if (isDemoMode) return { ok: true };
  const res = await fetchAppsScript(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token: API_TOKEN }),
  });
  return res.json();
}

const PRODUCTS_CACHE_KEY = "oiji-products-cache";

/**
 * 직전에 성공적으로 받아온 매물 목록.
 * Apps Script 응답이 5~70초로 매우 느리고 편차가 커서, 재방문 시
 * 캐시를 즉시 보여주고 새 데이터는 뒤에서 갱신한다.
 */
export function getCachedProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}

/** 방금 등록한 매물을 캐시 맨 앞에 즉시 반영 (CDN 캐시가 갱신되기 전까지의 공백 메움) */
export function prependCachedProduct(item: Product): void {
  const cur = getCachedProducts();
  setCachedProducts([item, ...cur.filter((p) => p.id !== item.id)]);
}

function setCachedProducts(items: Product[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // 용량 초과 등은 무시
  }
}

/**
 * 매물 목록 조회.
 * 1순위: /api/items (Netlify Function + CDN 캐시) — 보통 1초 미만
 * 2순위: Apps Script 직접 호출 — 함수가 없거나 실패할 때의 폴백 (10~40초)
 */
export async function listProducts(): Promise<Product[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return DEMO_PRODUCTS.filter((p) => p.status !== "삭제");
  }

  try {
    const res = await fetch("/api/items", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        setCachedProducts(data.items as Product[]);
        return data.items as Product[];
      }
    }
  } catch {
    // 폴백으로 진행
  }

  const res = await fetchAppsScript(APPS_SCRIPT_URL, { cache: "no-store" });
  const data = await res.json();
  const items = (data.items || []) as Product[];
  if (items.length > 0) setCachedProducts(items);
  return items;
}

/** 마지막 시트 변경 타임스탬프 조회 (실시간 동기화 폴링용) */
export async function getLastModified(): Promise<number> {
  if (isDemoMode) return 0;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=ping`, { cache: "no-store" });
    const data = await res.json();
    return data.lastModified || 0;
  } catch {
    return 0;
  }
}

/** 매물 등록 */
export async function createProduct(item: NewProduct): Promise<{ ok: boolean; id?: string }> {
  if (isDemoMode) {
    const id = `p${Date.now()}`;
    DEMO_PRODUCTS.unshift({
      ...item,
      id,
      createdAt: new Date().toISOString(),
      status: "판매중",
      jjim: 0,
      chats: 0,
    });
    return { ok: true, id };
  }
  return post({ action: "create", item });
}

/** 매물 수정 (찜 수 증감 등) */
export async function updateProduct(
  id: string,
  patch: Partial<Product>
): Promise<{ ok: boolean }> {
  if (isDemoMode) {
    const idx = DEMO_PRODUCTS.findIndex((p) => p.id === id);
    if (idx >= 0) Object.assign(DEMO_PRODUCTS[idx], patch);
    return { ok: true };
  }
  return post({ action: "update", id, patch });
}

/** 매물 삭제 (soft delete) */
export async function removeProduct(id: string): Promise<{ ok: boolean }> {
  if (isDemoMode) {
    const idx = DEMO_PRODUCTS.findIndex((p) => p.id === id);
    if (idx >= 0) DEMO_PRODUCTS[idx].status = "삭제";
    return { ok: true };
  }
  return post({ action: "delete", id });
}

/** 내 매물 전체의 nick을 새 닉네임으로 일괄 업데이트 */
export async function updateNickForUser(uid: string, nick: string): Promise<void> {
  if (isDemoMode) return;
  await post({ action: "updateNick", uid, nick });
}
