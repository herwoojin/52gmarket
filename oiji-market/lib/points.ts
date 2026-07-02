const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_OIJI_API_TOKEN || "";

export interface PointRecord {
  id: string;
  uid: string;
  nick: string;
  type: "nanum" | "sale";
  productId: string;
  points: number;
  note: string;
  createdAt: string;
  year: number;
  month: number;
}

export interface PointsRankStat {
  uid: string;
  nick: string;
  total: number;
  nanum: number;
  sale: number;
  points: number;
}

export async function fetchMyPoints(uid: string): Promise<PointRecord[]> {
  if (!APPS_SCRIPT_URL) return [];
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=myPoints&uid=${encodeURIComponent(uid)}`, { cache: "no-store" });
    const data = await res.json();
    return data.records || [];
  } catch {
    return [];
  }
}

export async function fetchPointsRanking(period: "month" | "year" | "all"): Promise<PointsRankStat[]> {
  if (!APPS_SCRIPT_URL) return [];
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=pointsRanking&period=${period}`, { cache: "no-store" });
    const data = await res.json();
    return data.ranking || [];
  } catch {
    return [];
  }
}

export async function buyerConfirmDeal(productId: string): Promise<{ ok: boolean }> {
  if (!APPS_SCRIPT_URL) return { ok: true };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "confirmDeal", token: API_TOKEN, id: productId }),
  });
  return res.json();
}
