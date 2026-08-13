import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, isFirebaseEnabled } from "./firebase";
import type { Product } from "@/types";
import type { PointRecord, PointsRankStat } from "./points";

/**
 * Firestore 구조: points/{productId}
 *
 * 문서 id 를 productId 로 두어 한 매물당 한 번만 적립되게 한다(멱등).
 * 매물이 삭제돼도 이 기록은 남는다.
 */

const NANUM_POINTS = 3;
const SALE_POINTS = 2;

function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

/** 거래완료 시 포인트 적립 (이미 적립된 매물이면 아무 일도 하지 않음) */
export async function recordPointsFs(product: Product): Promise<boolean> {
  if (!isFirebaseEnabled || !db || !product?.id || !product.uid) return false;

  const ref = doc(db, "points", product.id);
  const existing = await getDoc(ref).catch(() => null);
  if (existing?.exists()) return false; // 중복 적립 방지

  const isNanum = product.deal === "나눔";
  const now = new Date();
  await setDoc(ref, {
    uid: product.uid,
    nick: product.nick || "익명",
    type: isNanum ? "nanum" : "sale",
    productId: product.id,
    productTitle: product.title || "",
    points: isNanum ? NANUM_POINTS : SALE_POINTS,
    note: "거래완료",
    createdAt: serverTimestamp(),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(id: string, v: any): PointRecord {
  return {
    id,
    uid: String(v.uid || ""),
    nick: String(v.nick || "익명"),
    type: v.type === "nanum" ? "nanum" : "sale",
    productId: String(v.productId || id),
    points: Number(v.points) || 0,
    note: String(v.note || ""),
    createdAt: tsToIso(v.createdAt),
    year: Number(v.year) || new Date().getFullYear(),
    month: Number(v.month) || new Date().getMonth() + 1,
  };
}

/** 전체 포인트 기록 (내부용) */
async function fetchAllPoints(): Promise<PointRecord[]> {
  if (!isFirebaseEnabled || !db) return [];
  const snap = await getDocs(collection(db, "points"));
  return snap.docs.map((d) => toRecord(d.id, d.data()));
}

/** 내 포인트 이력 */
export async function fetchMyPointsFs(uid: string): Promise<PointRecord[]> {
  if (!uid) return [];
  const all = await fetchAllPoints();
  return all.filter((r) => r.uid === uid);
}

/** 기간별 포인트 랭킹 집계 */
export async function fetchPointsRankingFs(
  period: "month" | "year" | "all"
): Promise<PointsRankStat[]> {
  const all = await fetchAllPoints();
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;

  const map: Record<string, PointsRankStat> = {};
  all.forEach((r) => {
    if (period === "month" && (r.year !== cy || r.month !== cm)) return;
    if (period === "year" && r.year !== cy) return;
    if (!map[r.uid]) {
      map[r.uid] = { uid: r.uid, nick: r.nick, total: 0, nanum: 0, sale: 0, points: 0 };
    }
    const s = map[r.uid];
    s.nick = r.nick || s.nick;
    s.total += 1;
    s.points += r.points;
    if (r.type === "nanum") s.nanum += 1;
    else s.sale += 1;
  });

  return Object.values(map).sort((a, b) => b.points - a.points);
}
