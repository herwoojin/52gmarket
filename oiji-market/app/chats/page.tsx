"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSellerChats, type SellerChatRoom } from "@/lib/chat";
import { listProducts } from "@/lib/sheets";
import ChatSheet from "@/components/ChatSheet";
import type { Product } from "@/types";
import { useAuth } from "@/lib/auth";
import { MessageCircle, Loader2 } from "lucide-react";

export default function ChatsPage() {
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<SellerChatRoom | null>(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["sellerChats", user?.email],
    queryFn: () => fetchSellerChats(user?.email || ""),
    enabled: !!user?.email,
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    staleTime: 60_000,
  });

  if (!user) return null;

  const getProduct = (room: SellerChatRoom): Product => {
    const found = products.find((p) => p.id === room.productId);
    if (found) return found;
    return {
      id: room.productId,
      title: room.productTitle,
      uid: user.email || "",
      nick: room.buyerNick || room.buyerUid.split("@")[0],
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
          {rooms.map((room) => (
            <button
              key={room.roomId}
              onClick={() => setSelectedRoom(room)}
              className="w-full rounded-oiji border border-skin-line bg-skin-1 p-4 text-left transition-colors hover:border-cuke/40 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] font-bold text-cuke-bright">
                    @{room.buyerNick || room.buyerUid.split("@")[0]}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-ink">
                    {room.productTitle}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[12px] text-muted">{room.lastMsg}</p>
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
          ))}
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
