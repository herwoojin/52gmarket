import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isFirebaseEnabled } from "./firebase";
import type { Product, NewProduct } from "@/types";

/** Firestore 구조: products/{id} */

function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  return new Date().toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProduct(id: string, v: any): Product {
  return {
    id,
    uid: String(v.uid || ""),
    deal: v.deal || "나눔",
    category: v.category || "기타",
    title: String(v.title || ""),
    price: Number(v.price) || 0,
    desc: String(v.desc || ""),
    loc: String(v.loc || ""),
    nick: String(v.nick || "익명"),
    photoURL: String(v.photoURL || ""),
    status: v.status || "판매중",
    jjim: Number(v.jjim) || 0,
    chats: Number(v.chats) || 0,
    createdAt: tsToIso(v.createdAt),
  };
}

/** 매물 목록 실시간 구독 — 삭제된 항목 제외 */
export function subscribeProducts(
  onChange: (items: Product[]) => void
): Unsubscribe | null {
  if (!isFirebaseEnabled || !db) return null;
  const q = query(collection(db, "products"), where("status", "!=", "삭제"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => toProduct(d.id, d.data()));
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onChange(items);
    },
    (err) => console.error("[products] 구독 오류:", err)
  );
}

/** 1회성 조회 (구독을 걸기 어려운 곳에서 사용) */
export async function fetchProductsOnce(): Promise<Product[]> {
  if (!isFirebaseEnabled || !db) return [];
  const snap = await getDocs(query(collection(db, "products"), where("status", "!=", "삭제")));
  const items = snap.docs.map((d) => toProduct(d.id, d.data()));
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export async function createProductFs(
  item: NewProduct
): Promise<{ ok: boolean; id?: string }> {
  if (!isFirebaseEnabled || !db) return { ok: false };
  const id = `p${Date.now()}`;
  await setDoc(doc(db, "products", id), {
    ...item,
    status: "판매중",
    jjim: 0,
    chats: 0,
    createdAt: serverTimestamp(),
  });
  return { ok: true, id };
}

export async function updateProductFs(
  id: string,
  patch: Partial<Product>
): Promise<boolean> {
  if (!isFirebaseEnabled || !db) return false;
  await updateDoc(doc(db, "products", id), { ...patch });
  return true;
}

/** 삭제는 상태 변경(soft delete) — 기존 시트 방식과 동일하게 이력 보존 */
export async function removeProductFs(id: string): Promise<boolean> {
  return updateProductFs(id, { status: "삭제" as Product["status"] });
}
