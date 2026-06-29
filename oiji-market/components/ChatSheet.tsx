"use client";

import { useState, useRef, useEffect } from "react";
import type { Product, ChatMessage } from "@/types";
import { X, Send } from "lucide-react";

const QUICK_REPLIES = [
  "아직 가능할까요?",
  "미리 찜할게요 🥒",
  "픽업 시간은?",
  "상태가 궁금해요",
];

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && product) {
      // 데모: 판매자 인사 메시지
      setMessages([
        {
          id: "sys-1",
          senderUid: product.uid,
          senderNick: product.nick,
          text: `안녕하세요! '${product.title}' 관련 문의 환영해요 😊`,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, [isOpen, product]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen || !product) return null;

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderUid: currentUid,
      senderNick: currentNick,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");

    // 데모: 자동 응답
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          senderUid: product.uid,
          senderNick: product.nick,
          text: "확인했어요! 픽업 시간 맞춰볼게요 🥒",
          createdAt: new Date().toISOString(),
        },
      ]);
    }, 1500);
  };

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
            <h3 className="text-[15px] font-bold">@{product.nick}</h3>
            <p className="text-[12px] text-muted line-clamp-1">{product.title}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-skin-2 text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.map((msg) => {
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
          })}
          <div ref={bottomRef} />
        </div>

        {/* 빠른 답장 */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className="shrink-0 rounded-full border border-skin-line bg-skin-2 px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-cuke hover:text-cuke"
            >
              {reply}
            </button>
          ))}
        </div>

        {/* 입력 */}
        <div
          className="flex gap-2 border-t border-skin-line px-4 py-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="메시지를 입력하세요"
            className="flex-1 rounded-xl border border-skin-line bg-skin-2 px-4 py-3 text-[14px] text-ink outline-none transition-colors focus:border-cuke"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-cuke text-skin-0 transition-opacity disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
