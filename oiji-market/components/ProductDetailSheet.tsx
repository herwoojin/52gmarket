"use client";

import type { Product } from "@/types";
import { Heart, MessageCircle, MapPin, Tag, X, CreditCard } from "lucide-react";

interface ProductDetailSheetProps {
  product: Product | null;
  isOpen: boolean;
  isJjimed?: boolean;
  onClose: () => void;
  onJjimToggle?: (id: string) => void;
  onChat?: (product: Product) => void;
  onPay?: (product: Product) => void;
}

export default function ProductDetailSheet({
  product,
  isOpen,
  isJjimed = false,
  onClose,
  onJjimToggle,
  onChat,
  onPay,
}: ProductDetailSheetProps) {
  if (!isOpen || !product) return null;

  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 시트 */}
      <div className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-[920px] animate-slide-up rounded-t-3xl border-t border-skin-line bg-skin-1 shadow-2xl"
        style={{ maxHeight: "85vh" }}
      >
        {/* 핸들 */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-skin-line" />
        </div>

        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-skin-2 text-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto px-5 pb-36" style={{ maxHeight: "calc(85vh - 48px)" }}>
          {/* 이미지 */}
          <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-2xl bg-skin-2">
            {product.photoURL ? (
              <img
                src={product.photoURL}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-7xl opacity-30">
                🥒
              </div>
            )}
            {isDone && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="rounded-xl bg-neutral-600 px-6 py-3 text-lg font-extrabold text-white">
                  거래완료
                </span>
              </div>
            )}
          </div>

          {/* 제목 & 가격 */}
          <h2 className="text-xl font-extrabold leading-tight tracking-tight">
            {product.title}
          </h2>
          <p className={`mt-2 text-2xl font-extrabold ${isFree ? "text-warn" : "text-ink"}`}>
            {isFree ? "무료나눔 🎁" : `${product.price.toLocaleString()}원`}
          </p>

          {/* 메타 */}
          <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-skin-2 px-3 py-1.5 text-muted">
              <MapPin size={13} /> {product.loc}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-skin-2 px-3 py-1.5 font-semibold text-cuke-bright">
              @{product.nick}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-skin-2 px-3 py-1.5 text-muted">
              <Tag size={13} /> {product.category}
            </span>
          </div>

          {/* 통계 */}
          <div className="mt-3 flex gap-4 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Heart size={12} /> 찜 {product.jjim}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} /> 대화 {product.chats}
            </span>
          </div>

          {/* 설명 */}
          <div className="mt-5 rounded-2xl bg-skin-2 p-4">
            <h3 className="mb-2 text-[13px] font-bold text-muted">상품 설명</h3>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {product.desc || "설명이 없어요."}
            </p>
          </div>
        </div>

        {/* 하단 액션 */}
        <div
          className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-w-[920px] flex gap-3 border-t border-skin-line bg-skin-1 px-5 py-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {/* 찜 */}
          <button
            onClick={() => onJjimToggle?.(product.id)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
              isJjimed
                ? "border-cuke bg-cuke text-skin-0"
                : "border-skin-line bg-skin-2 text-muted hover:text-cuke"
            }`}
          >
            <Heart size={20} fill={isJjimed ? "currentColor" : "none"} />
          </button>

          {/* 대화 */}
          <button
            onClick={() => onChat?.(product)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-2 text-[15px] font-bold text-ink transition-colors hover:border-cuke"
          >
            <MessageCircle size={18} />
            대화하기
          </button>

          {/* 결제 (판매일 때만) */}
          {!isFree && !isDone && (
            <button
              onClick={() => onPay?.(product)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-pay text-[15px] font-bold text-white transition-colors hover:bg-pay/90"
            >
              <CreditCard size={18} />
              결제하기
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </>
  );
}
