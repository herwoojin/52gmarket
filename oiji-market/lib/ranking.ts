const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_OIJI_API_TOKEN || "";
const isDemoMode = !APPS_SCRIPT_URL;

export interface UserStat {
  uid: string;
  nick: string;
  total: number;
  nanum: number;
  sale: number;
  points: number;
}

export interface MonthlyNanumi {
  uid: string;
  nick: string;
  month: string;
  reason?: string;
  setAt: string;
}

export interface RankingData {
  ranking: UserStat[];
  monthlyNanumi: MonthlyNanumi | null;
}

const DEMO_RANKING: UserStat[] = [
  { uid: "woojin@gsretail.com", nick: "우진파워", total: 7, nanum: 4, sale: 3, points: 18 },
  { uid: "miso@gsretail.com",   nick: "나눔천사", total: 5, nanum: 5, sale: 0, points: 15 },
  { uid: "kang@gsretail.com",   nick: "절약왕강",  total: 4, nanum: 1, sale: 3, points: 9 },
  { uid: "yoon@gsretail.com",   nick: "유통마스터", total: 2, nanum: 1, sale: 1, points: 5 },
];

export async function fetchRanking(): Promise<RankingData> {
  if (isDemoMode) {
    return {
      ranking: DEMO_RANKING,
      monthlyNanumi: {
        uid: "miso@gsretail.com",
        nick: "나눔천사",
        month: new Date().toISOString().slice(0, 7),
        reason: "5건 나눔으로 사무실 소모품 절약에 기여!",
        setAt: new Date().toISOString(),
      },
    };
  }
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=ranking`, { cache: "no-store" });
    const data = await res.json();
    return { ranking: data.ranking || [], monthlyNanumi: data.monthlyNanumi || null };
  } catch {
    return { ranking: [], monthlyNanumi: null };
  }
}

export async function setMonthlyNanumi(winner: {
  uid: string;
  nick: string;
  month: string;
  reason?: string;
}): Promise<{ ok: boolean }> {
  if (isDemoMode) return { ok: true };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "setNanumi", token: API_TOKEN, ...winner }),
  });
  return res.json();
}
