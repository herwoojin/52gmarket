const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
const isDemoMode = !APPS_SCRIPT_URL;

export interface ChatMsg {
  id: string;
  senderUid: string;
  senderNick: string;
  text: string;
  createdAt: number;
}

/** roomId = productId__sorted(uid1, uid2) — 두 사람이 같은 방을 공유 */
export function buildRoomId(productId: string, uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort();
  return `${productId}__${a}__${b}`;
}

export async function fetchMessages(roomId: string): Promise<ChatMsg[]> {
  if (isDemoMode) return [];
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=chat&roomId=${encodeURIComponent(roomId)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return (data.messages as ChatMsg[]) || [];
  } catch {
    return [];
  }
}

export interface SellerChatRoom {
  roomId: string;
  productId: string;
  productTitle: string;
  buyerUid: string;
  buyerNick: string;
  lastMsg: string;
  lastAt: number;
  msgCount: number;
}

export async function fetchSellerChats(sellerUid: string): Promise<SellerChatRoom[]> {
  if (isDemoMode || !sellerUid) return [];
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=sellerChats&uid=${encodeURIComponent(sellerUid)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return (data.rooms as SellerChatRoom[]) || [];
  } catch {
    return [];
  }
}

export async function sendMessage(
  roomId: string,
  msg: { senderUid: string; senderNick: string; text: string }
): Promise<{ ok: boolean; id?: string }> {
  if (isDemoMode) return { ok: true, id: `msg-${Date.now()}` };
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "sendChat", roomId, message: msg }),
  });
  return res.json();
}
