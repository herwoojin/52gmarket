const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_OIJI_API_TOKEN || "";

export async function fetchKeywords(uid: string): Promise<string[]> {
  if (!APPS_SCRIPT_URL || !uid) return [];
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=getKeywords&uid=${encodeURIComponent(uid)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.keywords || [];
  } catch {
    return [];
  }
}

export async function saveKeywords(uid: string, keywords: string[]): Promise<void> {
  if (!APPS_SCRIPT_URL || !uid) return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "setKeywords", token: API_TOKEN, uid, keywords }),
    });
  } catch {
    // 서버 반영 실패해도 로컬 상태는 유지
  }
}
