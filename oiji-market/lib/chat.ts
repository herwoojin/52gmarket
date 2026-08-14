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

/** uid가 비어 유효하지 않은 방(예: ...__undefined)은 서버 요청을 보내지 않는다 */
function isValidRoomId(roomId: string): boolean {
  if (!roomId) return false;
  const parts = roomId.split("__");
  return parts.length >= 3 && parts.every((p) => p && p !== "undefined" && p !== "null");
}

export async function fetchMessages(roomId: string): Promise<ChatMsg[]> {
  if (isDemoMode || !isValidRoomId(roomId)) return [];
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
  /** uid → 마지막으로 읽은 시각(ms). 상대의 읽음 여부 판정에도 쓰인다 */
  reads?: Record<string, number>;
  /** 마지막 메시지를 보낸 사람 (알림 대상 판정용) */
  lastSenderUid?: string;
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

const CHAT_READ_PREFIX = "oiji-chat-read-";

/** 로컬 캐시 — 서버 응답 전 즉시 UI 반영용 (낙관적 업데이트) */
export function markRoomAsRead(roomId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_READ_PREFIX + roomId, String(Date.now()));
}

function getLocalLastRead(roomId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(CHAT_READ_PREFIX + roomId) || 0);
}

/** 계정 기준 서버 읽음 상태 — 로그인한 기기 어디서든 동일하게 반영됨 */
export async function fetchChatReads(uid: string): Promise<Record<string, number>> {
  if (isDemoMode || !uid) return {};
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=chatReads&uid=${encodeURIComponent(uid)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return (data.reads as Record<string, number>) || {};
  } catch {
    return {};
  }
}

export async function markRoomReadRemote(uid: string, roomId: string): Promise<void> {
  markRoomAsRead(roomId); // 즉시 로컬 반영
  if (isDemoMode || !uid) return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "markChatRead", uid, roomId }),
    });
  } catch {
    // 서버 반영 실패해도 로컬 읽음 상태는 유지
  }
}

/** 로컬 캐시와 서버 값 중 더 최신 값을 신뢰(기기 간 동기화 지연 대비) */
export function getRoomLastRead(roomId: string, reads?: Record<string, number>): number {
  return Math.max(getLocalLastRead(roomId), reads?.[roomId] || 0);
}

/** 내가 이 방에서 마지막으로 읽은 시각 (방 문서의 reads 맵 우선) */
export function myLastReadOf(room: SellerChatRoom, myUid: string): number {
  return Math.max(getLocalLastRead(room.roomId), room.reads?.[myUid] ?? 0);
}

/**
 * 안읽은 대화방 수.
 * 마지막 메시지가 내가 보낸 것이면 안읽음으로 세지 않는다.
 */
export function countUnreadRooms(rooms: SellerChatRoom[], reads?: Record<string, number>, myUid?: string): number {
  return rooms.filter((r) => {
    const lastRead = myUid
      ? myLastReadOf(r, myUid)
      : getRoomLastRead(r.roomId, reads);
    return r.lastAt > lastRead;
  }).length;
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
