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

/**
 * 이미 거래완료된 매물에 대해 포인트를 소급 적립한다.
 *
 * 완료 시각을 따로 저장하지 않으므로 등록일(createdAt)을 기준 연·월로 쓴다.
 * 문서 id 가 매물 id 라 여러 번 실행해도 중복 적립되지 않는다.
 */
export async function backfillPointsFs(
  onLog?: (line: string) => void
): Promise<{ added: number; skipped: number; failed: number }> {
  const log = (l: string) => onLog?.(l);
  if (!isFirebaseEnabled || !db) {
    log("Firebase 설정이 없습니다.");
    return { added: 0, skipped: 0, failed: 0 };
  }

  const snap = await getDocs(collection(db, "products"));
  const done = snap.docs.filter((d) => d.data()?.status === "거래완료");
  log(`거래완료 매물 ${done.length}건 확인`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const d of done) {
    const v = d.data();
    const ref = doc(db, "points", d.id);
    try {
      const cur = await getDoc(ref);
      if (cur.exists()) {
        skipped++;
        continue;
      }
      const isNanum = v.deal === "나눔";
      const created =
        v.createdAt instanceof Timestamp ? v.createdAt.toDate() : new Date();
      await setDoc(ref, {
        uid: String(v.uid || ""),
        nick: String(v.nick || "익명"),
        type: isNanum ? "nanum" : "sale",
        productId: d.id,
        productTitle: String(v.title || ""),
        points: isNanum ? NANUM_POINTS : SALE_POINTS,
        note: "소급 적립",
        createdAt: v.createdAt ?? serverTimestamp(),
        year: created.getFullYear(),
        month: created.getMonth() + 1,
      });
      added++;
      log(`  + ${v.title || d.id} (${isNanum ? "나눔 3점" : "판매 2점"})`);
    } catch (err) {
      failed++;
      log(`  ⚠️ ${v.title || d.id} 실패: ${String(err)}`);
    }
  }

  log(`완료 — 신규 ${added}건 / 이미 적립됨 ${skipped}건 / 실패 ${failed}건`);
  return { added, skipped, failed };
}

/**
 * 집계용 포인트 기록 전체.
 *
 * points 컬렉션(영구 기록)을 기본으로 하되, 아직 적립 기록이 만들어지지
 * 않은 '거래완료' 매물도 함께 계산한다. 이렇게 하면 소급 적립을 실행하지
 * 않아도 랭킹이 정확히 나오고, 적립이 누락돼도 집계가 비지 않는다.
 * (points 에 이미 있는 매물은 그쪽 기록을 우선한다)
 */
async function fetchAllPoints(): Promise<PointRecord[]> {
  if (!isFirebaseEnabled || !db) return [];

  const byProduct = new Map<string, PointRecord>();

  try {
    const snap = await getDocs(collection(db, "points"));
    snap.docs.forEach((d) => byProduct.set(d.id, toRecord(d.id, d.data())));
  } catch {
    // 포인트 컬렉션을 못 읽어도 아래 매물 기준 집계는 시도한다
  }

  try {
    const snap = await getDocs(collection(db, "products"));
    snap.docs.forEach((d) => {
      const v = d.data();
      if (v?.status !== "거래완료" || byProduct.has(d.id)) return;
      const isNanum = v.deal === "나눔";
      const created =
        v.createdAt instanceof Timestamp ? v.createdAt.toDate() : new Date();
      byProduct.set(d.id, {
        id: d.id,
        uid: String(v.uid || ""),
        nick: String(v.nick || "익명"),
        type: isNanum ? "nanum" : "sale",
        productId: d.id,
        points: isNanum ? NANUM_POINTS : SALE_POINTS,
        note: "거래완료",
        createdAt: created.toISOString(),
        year: created.getFullYear(),
        month: created.getMonth() + 1,
      });
    });
  } catch {
    // 매물을 못 읽으면 points 기록만으로 집계
  }

  return Array.from(byProduct.values());
}

/** 내 포인트 이력 */
export async function fetchMyPointsFs(uid: string): Promise<PointRecord[]> {
  if (!uid) return [];
  const all = await fetchAllPoints();
  return all
    .filter((r) => r.uid === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
