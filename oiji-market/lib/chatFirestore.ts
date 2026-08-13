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

/** 메시지 전송 — 대화방 메타도 함께 갱신해 목록에서 바로 보이게 한다 */
export async function sendMessageFs(
  roomId: string,
  msg: { senderUid: string; senderNick: string; text: string },
  meta: { productId: string; productTitle: string; participants: string[] }
): Promise<boolean> {
  if (!isFirebaseEnabled || !db) return false;
  const text = msg.text.trim();
  if (!text) return false;

  const roomRef = doc(db, "rooms", roomId);

  // 대화방 문서를 먼저 만든다.
  // 보안 규칙이 메시지 작성 권한을 '대화방의 participants' 로 판단하므로,
  // 방이 없는 상태에서 메시지를 먼저 쓰면 첫 메시지가 항상 거부된다.
  let isNewRoom = false;
  try {
    const snap = await getDoc(roomRef);
    isNewRoom = !snap.exists();
  } catch {
    // 조회가 막혀도 setDoc(merge) 로 방 생성/갱신은 진행한다
    isNewRoom = true;
  }

  await setDoc(
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
    },
    { merge: true }
  );

  await addDoc(collection(db, "rooms", roomId, "messages"), {
    senderUid: msg.senderUid,
    senderNick: msg.senderNick,
    text,
    createdAt: serverTimestamp(),
  });

  // 새 대화방이면 매물의 대화 수를 1 올린다 (카드에 표시되는 숫자)
  if (isNewRoom && meta.productId) {
    try {
      await updateDoc(doc(db, "products", meta.productId), { chats: increment(1) });
    } catch {
      // 카운터 갱신 실패가 대화 자체를 막지는 않도록 무시
    }
  }
  return true;
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
