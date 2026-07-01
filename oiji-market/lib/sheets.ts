import type { Product, NewProduct } from "@/types";
import { DEMO_PRODUCTS } from "./demo-data";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_OIJI_API_TOKEN || "";

const isDemoMode = !APPS_SCRIPT_URL;

// POST 헬퍼 — Content-Type text/plain 으로 프리플라이트 회피
async function post(payload: object) {
  if (isDemoMode) return { ok: true };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token: API_TOKEN }),
  });
  return res.json();
}

/** 매물 목록 조회 */
export async function listProducts(): Promise<Product[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return DEMO_PRODUCTS.filter((p) => p.status !== "삭제");
  }
  const res = await fetch(APPS_SCRIPT_URL, { cache: "no-store" });
  const data = await res.json();
  return data.items || [];
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
