"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Product } from "@/types";
import { X, Send, Loader2 } from "lucide-react";
import { buildRoomId, fetchMessages, sendMessage, type ChatMsg } from "@/lib/chat";

const QUICK_REPLIES = [
  "아직 가능할까요?",
  "미리 찜할게요 🥒",
  "픽업 시간은?",
  "상태가 궁금해요",
];

const POLL_INTERVAL = 5000;

interface ChatSheetProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  currentNick: string;
  currentUid: string;
}

export default function ChatSheet({
  product,
  isOpen,
  onClose,
  currentNick,
  currentUid,
}: ChatSheetProps) {
  // key prop이 product.id로 바뀔 때 자동 리셋되므로 초기값을 loading=true로 설정
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomIdRef = useRef<string>("");
  const optimisticCounter = useRef(0);

  useEffect(() => {
    if (!isOpen || !product) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const roomId = buildRoomId(product.id, product.uid, currentUid);
    roomIdRef.current = roomId;

    // 첫 로드 — setState는 항상 콜백 안에서만 호출
    fetchMessages(roomId).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
    });

    pollRef.current = setInterval(() => {
      fetchMessages(roomIdRef.current).then(setMessages);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, product, currentUid]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setInput("");
      setSending(true);

      // 낙관적 업데이트 — 카운터로 고유 ID 생성 (Date.now 불필요)
      const optimisticId = `opt-${(optimisticCounter.current += 1)}`;
      const optimistic: ChatMsg = {
        id: optimisticId,
        senderUid: currentUid,
        senderNick: currentNick,
        text: text.trim(),
        createdAt: 0,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        await sendMessage(roomIdRef.current, {
          senderUid: currentUid,
          senderNick: currentNick,
          text: text.trim(),
        });
        // 낙관적 메시지를 서버 응답으로 교체
        fetchMessages(roomIdRef.current).then(setMessages);
      } catch {
        // 낙관적 메시지 유지 (전송 실패 시 그대로 보임)
      } finally {
        setSending(false);
      }
    },
    [currentUid, currentNick, sending]
  );

  if (!isOpen || !product) return null;

  const isSelf = product.uid === currentUid;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-[920px] flex-col rounded-t-3xl border-t border-skin-line bg-skin-1 shadow-2xl"
        style={{ height: "75vh" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-skin-line px-5 py-3">
          <div>
            <h3 className="text-[15px] font-bold">
              {isSelf ? "내 매물" : `@${product.nick}`}
            </h3>
            <p className="text-[12px] text-muted line-clamp-1">{product.title}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-skin-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={22} className="animate-spin text-cuke" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl">🥒</span>
              <p className="text-[14px] font-bold text-muted">
                {isSelf ? "내 매물 채팅방이에요" : "첫 메시지를 보내보세요!"}
              </p>
              {!isSelf && (
                <p className="text-[12px] text-muted">
                  @{product.nick}님과 1:1 채팅이 시작됩니다
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderUid === currentUid;
              return (
                <div
                  key={msg.id}
                  className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                      isMine
                        ? "rounded-br-lg bg-cuke text-skin-0"
                        : "rounded-bl-lg bg-skin-2 text-ink"
                    }`}
                  >
                    {!isMine && (
                      <p className="mb-0.5 text-[11px] font-bold text-cuke-bright">
                        @{msg.senderNick}
                      </p>
                    )}
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* 빠른 답장 */}
        {!isSelf && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSend(reply)}
                disabled={sending}
                className="shrink-0 rounded-full border border-skin-line bg-skin-2 px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-cuke hover:text-cuke disabled:opacity-40"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* 입력창 */}
        <div
          className="flex gap-2 border-t border-skin-line px-4 py-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          {isSelf ? (
            <p className="flex-1 py-3 text-center text-[13px] text-muted">
              본인 매물에는 채팅을 보낼 수 없어요
            </p>
          ) : (
            <>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend(input);
                }}
                placeholder="메시지를 입력하세요"
                disabled={sending}
                className="flex-1 rounded-xl border border-skin-line bg-skin-2 px-4 py-3 text-[14px] text-ink outline-none transition-colors focus:border-cuke disabled:opacity-60"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || sending}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-cuke text-skin-0 transition-opacity disabled:opacity-40"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
