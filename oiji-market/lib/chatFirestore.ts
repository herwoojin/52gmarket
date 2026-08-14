import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isFirebaseEnabled, ensureFirebaseAuth } from "./firebase";
import type { ChatMsg, SellerChatRoom } from "./chat";

/**
 * Firestore 구조
 *   rooms/{roomId}                     — 대화방 메타 (참여자, 마지막 메시지)
 *   rooms/{roomId}/messages/{msgId}    — 메시지
 *   reads/{uid}_{roomId}               — 읽음 시각
 *
 * roomId = productId__uidA__uidB (uid 정렬) — 기존 규칙 그대로 유지
 */

function tsToMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

/** 대화방 메시지 실시간 구독 */
export function subscribeMessages(
  roomId: string,
  onChange: (msgs: ChatMsg[]) => void
): Unsubscribe | null {
  if (!isFirebaseEnabled || !db || !roomId) return null;
  const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMsg[] = snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          senderUid: String(v.senderUid || ""),
          senderNick: String(v.senderNick || "익명"),
          text: String(v.text || ""),
          // 서버 타임스탬프가 반영되기 전(로컬 반영 단계)에는 0 → 목록 맨 뒤에 표시
          createdAt: tsToMillis(v.createdAt),
        };
      });
      onChange(msgs);
    },
    (err) => {
      // 구독이 거부돼도 화면이 로딩 상태로 멈추지 않도록 빈 목록으로 알린다
      console.error("[chat] 구독 오류:", err);
      onChange([]);
    }
  );
}

/**
 * 메시지 전송.
 *
 * 서버 응답을 기다리지 않는다. Firestore 는 쓰기를 로컬에 즉시 반영하고
 * onSnapshot 이 곧바로 발화하므로, 기다리지 않아야 메시지가 지연 없이 뜬다.
 * (이전에는 getDoc → setDoc → addDoc 을 순차로 await 해서 왕복이 3~4번 발생했다)
 * 쓰기 순서는 SDK 가 보장하므로 방 생성 → 메시지 순서도 유지된다.
 */
export function sendMessageFs(
  roomId: string,
  msg: { senderUid: string; senderNick: string; text: string },
  meta: {
    productId: string;
    productTitle: string;
    participants: string[];
    isFirstMessage?: boolean;
  }
): void {
  if (!isFirebaseEnabled || !db) return;
  const text = msg.text.trim();
  if (!text) return;

  const roomRef = doc(db, "rooms", roomId);

  // 방 메타 갱신 + 보낸 사람은 읽은 것으로 처리
  setDoc(
    roomRef,
    {
      roomId,
      productId: meta.productId,
      productTitle: meta.productTitle,
      participants: meta.participants,
      lastMsg: text,
      lastSenderUid: msg.senderUid,
      lastSenderNick: msg.senderNick,
      lastAt: serverTimestamp(),
      reads: { [msg.senderUid]: serverTimestamp() },
    },
    { merge: true }
  ).catch((e) => console.error("[chat] 방 갱신 실패:", e));

  addDoc(collection(db, "rooms", roomId, "messages"), {
    senderUid: msg.senderUid,
    senderNick: msg.senderNick,
    text,
    createdAt: serverTimestamp(),
  }).catch((e) => console.error("[chat] 메시지 전송 실패:", e));

  // 첫 메시지면 매물의 대화 수를 올린다 (화면에 이미 알고 있는 정보로 판단)
  if (meta.isFirstMessage && meta.productId) {
    updateDoc(doc(db, "products", meta.productId), { chats: increment(1) }).catch(
      () => {}
    );
  }

  // 상대에게 푸시 알림 (앱스크립트가 OneSignal 키를 들고 대신 발송)
  const other = meta.participants.find((p) => p && p !== msg.senderUid);
  if (other) notifyChatPush(other, msg.senderNick, text, roomId);
}

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

/**
 * 새 메시지 푸시 요청.
 * OneSignal REST 키는 클라이언트에 둘 수 없으므로 앱스크립트를 경유한다.
 * 채팅 속도에 영향을 주지 않도록 결과를 기다리지 않는다.
 */
function notifyChatPush(
  toUid: string,
  fromNick: string,
  text: string,
  roomId: string
): void {
  if (!APPS_SCRIPT_URL) return;
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "pushChat", toUid, fromNick, text, roomId }),
  }).catch(() => {});
}

/** 내가 참여한 대화방 목록 실시간 구독 */
export function subscribeMyRooms(
  uid: string,
  onChange: (rooms: SellerChatRoom[]) => void
): Unsubscribe | null {
  if (!isFirebaseEnabled || !db || !uid) return null;

  let inner: Unsubscribe | null = null;
  let cancelled = false;
  ensureFirebaseAuth().then(() => {
    if (cancelled || !db) return;
    const q = query(collection(db, "rooms"), where("participants", "array-contains", uid));
    inner = onSnapshot(
    q,
    (snap) => {
      const rooms: SellerChatRoom[] = snap.docs.map((d) => {
        const v = d.data();
        const participants: string[] = Array.isArray(v.participants) ? v.participants : [];
        const other = participants.find((p) => p !== uid) || "";
        return {
          roomId: d.id,
          productId: String(v.productId || ""),
          productTitle: String(v.productTitle || ""),
          buyerUid: other,
          // 마지막 발신자가 상대방이면 그 닉네임을 표시명으로 쓴다
          buyerNick:
            String(v.lastSenderUid || "") !== uid ? String(v.lastSenderNick || "") : "",
          lastMsg: String(v.lastMsg || ""),
          lastAt: tsToMillis(v.lastAt),
          lastSenderUid: String(v.lastSenderUid || ""),
          msgCount: 0,
          reads: (() => {
            const raw = (v.reads || {}) as Record<string, unknown>;
            const out: Record<string, number> = {};
            Object.keys(raw).forEach((k) => { out[k] = tsToMillis(raw[k]); });
            return out;
          })(),
        };
      });
      rooms.sort((a, b) => b.lastAt - a.lastAt);
      onChange(rooms);
    },
    (err) => {
      console.error("[chat] 방 목록 구독 오류:", err);
      onChange([]);
    }
    );
  });

  return () => {
    cancelled = true;
    if (inner) inner();
  };
}

/**
 * 읽음 시각을 대화방 문서 안(reads 맵)에 기록한다.
 * 별도 컬렉션에 두면 보안 규칙상 본인 기록만 읽을 수 있어
 * '상대가 읽었는지'를 알 수 없다. 방 문서는 양쪽 참여자가 모두 읽을 수 있다.
 */
export async function markRoomReadFs(uid: string, roomId: string): Promise<void> {
  if (!isFirebaseEnabled || !db || !uid || !roomId) return;
  try {
    await setDoc(
      doc(db, "rooms", roomId),
      { reads: { [uid]: serverTimestamp() } },
      { merge: true }
    );
  } catch {
    // 방이 아직 없으면 무시 (첫 메시지 전송 시 생성된다)
  }
}

/** 대화방 한 곳을 구독 — 상대의 읽음 시각을 실시간으로 받기 위함 */
export function subscribeRoom(
  roomId: string,
  onChange: (reads: Record<string, number>) => void
): Unsubscribe | null {
  if (!isFirebaseEnabled || !db || !roomId) return null;
  return onSnapshot(
    doc(db, "rooms", roomId),
    (snap) => {
      const v = snap.data();
      const raw = (v?.reads || {}) as Record<string, unknown>;
      const out: Record<string, number> = {};
      Object.keys(raw).forEach((k) => { out[k] = tsToMillis(raw[k]); });
      onChange(out);
    },
    () => onChange({})
  );
}
