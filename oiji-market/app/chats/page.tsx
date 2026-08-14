"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSellerChats,
  fetchChatReads,
  markRoomReadRemote,
  getRoomLastRead,
  myLastReadOf,
  type SellerChatRoom,
} from "@/lib/chat";
import { listProducts } from "@/lib/sheets";
import ChatSheet from "@/components/ChatSheet";
import type { Product } from "@/types";
import { useAuth } from "@/lib/auth";
import { MessageCircle, Loader2 } from "lucide-react";
import { subscribeMyRooms, markRoomReadFs } from "@/lib/chatFirestore";
import { subscribeProducts } from "@/lib/productsFirestore";
import { isFirebaseEnabled } from "@/lib/firebase";

export default function ChatsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<SellerChatRoom | null>(null);
  // 읽음 상태를 리렌더 트리거하기 위한 로컬 카운터
  const [readTick, setReadTick] = useState(0);

  // Firebase 사용 시 실시간 구독, 아니면 기존 Apps Script 폴링
  const [fsRooms, setFsRooms] = useState<SellerChatRoom[] | null>(null);

  useEffect(() => {
    if (!isFirebaseEnabled || !user?.email) return;
    const u1 = subscribeMyRooms(user.email, setFsRooms);
    return () => { if (u1) u1(); };
  }, [user?.email]);

  const { data: polledRooms = [], isLoading: polling } = useQuery({
    queryKey: ["sellerChats", user?.email],
    queryFn: () => fetchSellerChats(user?.email || ""),
    enabled: !!user?.email && !isFirebaseEnabled,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: polledReads = {} } = useQuery({
    queryKey: ["chatReads", user?.email],
    queryFn: () => fetchChatReads(user?.email || ""),
    enabled: !!user?.email && !isFirebaseEnabled,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const rooms = isFirebaseEnabled ? (fsRooms ?? []) : polledRooms;
  const reads = isFirebaseEnabled ? {} : polledReads;
  const isLoading = isFirebaseEnabled ? fsRooms === null : polling;

  const [fsProducts, setFsProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!isFirebaseEnabled) return;
    const unsub = subscribeProducts(setFsProducts);
    return () => { if (unsub) unsub(); };
  }, []);

  const { data: polledProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    enabled: !isFirebaseEnabled,
    staleTime: 60_000,
  });

  const products = isFirebaseEnabled ? fsProducts : polledProducts;

  if (!user) return null;

  /** 매물이 거래완료/삭제면 종료된 대화로 본다 */
  const closedStatusOf = (room: SellerChatRoom): string | null => {
    const p = products.find((x) => x.id === room.productId);
    if (!p) return null;
    if (p.status === "거래완료") return "거래완료";
    if (p.status === "삭제") return "삭제된 매물";
    return null;
  };

  const isUnread = (room: SellerChatRoom) =>
    room.lastAt > (isFirebaseEnabled
      ? myLastReadOf(room, user?.email || "")
      : getRoomLastRead(room.roomId, reads));

  const openRoom = (room: SellerChatRoom) => {
    setReadTick((t) => t + 1);
    setSelectedRoom(room);
    if (isFirebaseEnabled) {
      // 구독 중이라 별도 갱신 없이 즉시 반영된다
      markRoomReadFs(user?.email || "", room.roomId);
      return;
    }
    markRoomReadRemote(user?.email || "", room.roomId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["sellerChats"] });
      queryClient.invalidateQueries({ queryKey: ["chatReads"] });
    });
  };

  const getProduct = (room: SellerChatRoom): Product => {
    const found = products.find((p) => p.id === room.productId);
    if (found) return found;
    return {
      id: room.productId,
      title: room.productTitle,
      uid: user.email || "",
      nick: room.buyerNick || (room.buyerUid && room.buyerUid !== "undefined" ? room.buyerUid.split("@")[0] : "익명"),
      deal: "나눔",
      category: "기타",
      price: 0,
      desc: "",
      loc: "",
      photoURL: "",
      status: "판매중",
      jjim: 0,
      chats: 0,
      createdAt: "",
    };
  };

  return (
    <div className="animate-fade-in px-4 pt-5 pb-2">
      <h2 className="mb-5 text-xl font-extrabold tracking-tight">받은 채팅</h2>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin text-cuke" />
        </div>
      )}

      {!isLoading && rooms.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">💬</span>
          <p className="text-[15px] font-bold text-muted">받은 채팅이 없어요</p>
          <p className="text-[13px] text-muted">
            구매자가 내 매물에 대화를 시작하면 여기에 표시돼요
          </p>
        </div>
      )}

      {!isLoading && rooms.length > 0 && (
        <div className="flex flex-col gap-2">
          {[...rooms]
            .sort((a, b) => {
              // 종료된 대화는 아래로 내린다
              const ca = closedStatusOf(a) ? 1 : 0;
              const cb = closedStatusOf(b) ? 1 : 0;
              if (ca !== cb) return ca - cb;
              return b.lastAt - a.lastAt;
            })
            .map((room) => {
            const unread = isUnread(room);
            const closed = closedStatusOf(room);
            return (
              <button
                key={room.roomId + readTick}
                onClick={() => openRoom(room)}
                className={`w-full rounded-oiji border p-4 text-left transition-colors active:scale-[0.99] ${
                  closed
                    ? "border-skin-line bg-skin-1/50 opacity-60 hover:opacity-80"
                    : unread
                    ? "border-cuke/40 bg-cuke/5 hover:border-cuke/60"
                    : "border-skin-line bg-skin-1 hover:border-cuke/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {unread && !closed && (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                      <p className={`line-clamp-1 text-[13px] font-bold ${unread ? "text-cuke" : "text-cuke-bright"}`}>
                        @{room.buyerNick || (room.buyerUid && room.buyerUid !== "undefined" ? room.buyerUid.split("@")[0] : "익명")}
                      </p>
                    </div>
                    <p className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${unread && !closed ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                      {closed && (
                        <span className="shrink-0 rounded-md bg-neutral-600/70 px-1.5 py-0.5 text-[10px] font-bold text-neutral-200">
                          {closed}
                        </span>
                      )}
                      <span className="line-clamp-1">{room.productTitle}</span>
                    </p>
                    <p className={`mt-1 line-clamp-1 text-[12px] ${unread ? "font-semibold text-ink/80" : "text-muted"}`}>
                      {room.lastMsg}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {room.lastAt > 0 && (
                      <p className="text-[11px] text-muted">
                        {new Date(room.lastAt).toLocaleDateString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                        })}
                      </p>
                    )}
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                      <MessageCircle size={11} /> {room.msgCount}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedRoom && (
        <ChatSheet
          key={selectedRoom.roomId}
          product={getProduct(selectedRoom)}
          isOpen={true}
          onClose={() => setSelectedRoom(null)}
          currentNick={user.nick || "오이박사"}
          currentUid={user.email || ""}
          roomIdOverride={selectedRoom.roomId}
          sellerView={true}
        />
      )}
    </div>
  );
}
