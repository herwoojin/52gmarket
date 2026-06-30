"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { Heart, MapPin, MessageCircle, Pencil } from "lucide-react";

interface ProductCardProps {
  product: Product;
  isJjimed?: boolean;
  currentUid?: string;
  onJjimToggle?: (id: string) => void;
  onClick?: (product: Product) => void;
  onEditClick?: (product: Product) => void;
}

function normalizeDriveUrl(url: string | undefined): string {
  if (!url) return "";
  // 표시용 텍스트 / 만료된 blob → 이미지 없음
  if (url.startsWith("blob:") || url === "이미지 보기" || url === "이미지링크") return "";
  // thumbnail 포맷(이전 버그) → uc 포맷으로 변환
  if (url.includes("drive.google.com/thumbnail")) {
    const m = url.match(/id=([^&]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }
  return url;
}

export default function ProductCard({
  product,
  isJjimed = false,
  currentUid,
  onJjimToggle,
  onClick,
  onEditClick,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";
  const isOwner = !!currentUid && product.uid === currentUid;
  // blob: URL은 새로고침 시 만료 → 즉시 fallback; thumbnail 포맷은 uc 포맷으로 변환
  const resolvedUrl = normalizeDriveUrl(product.photoURL);
  const showImg = !!resolvedUrl && !imgError;

  return (
    <article
      className={`group cursor-pointer overflow-hidden rounded-oiji border bg-skin-1 transition-all active:scale-[0.98] ${
        isOwner
          ? "border-cuke/40 hover:border-cuke"
          : "border-skin-line hover:border-cuke/30"
      }`}
      onClick={() => onClick?.(product)}
    >
      {/* 썸네일 */}
      <div className="relative aspect-square overflow-hidden bg-skin-2">
        {showImg ? (
          <img
            src={resolvedUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            crossOrigin="anonymous"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-40">
            🥒
          </div>
        )}

        {/* 배지 */}
        {isDone ? (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-neutral-600/80 px-2.5 py-1 text-[11px] font-extrabold text-neutral-200">
            거래완료
          </span>
        ) : isFree ? (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-warn px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
            무료나눔
          </span>
        ) : (
          <span className="absolute left-2.5 top-2.5 rounded-lg border border-cuke bg-skin-0/80 px-2.5 py-1 text-[11px] font-extrabold text-flesh">
            판매
          </span>
        )}

        {/* 우상단 버튼: 내 매물이면 편집, 아니면 찜 */}
        {isOwner ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClick?.(product);
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-cuke/60 bg-cuke/80 text-skin-0 shadow backdrop-blur-sm transition-all hover:bg-cuke"
            title="내 매물 수정"
          >
            <Pencil size={14} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJjimToggle?.(product.id);
            }}
            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-all ${
              isJjimed
                ? "border-cuke bg-cuke text-skin-0"
                : "border-white/10 bg-skin-0/60 text-ink hover:bg-cuke/20"
            }`}
          >
            <Heart size={15} fill={isJjimed ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* 본문 */}
      <div className="p-2.5 pb-3">
        <h3 className="line-clamp-2 min-h-[35px] text-[13.5px] font-bold leading-snug tracking-tight">
          {product.title}
        </h3>

        <p className={`mt-1.5 text-[15px] font-extrabold ${isFree ? "text-warn" : "text-ink"}`}>
          {isFree ? "무료나눔" : `${product.price.toLocaleString()}원`}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {product.loc}
          </span>
          <span className="font-semibold text-cuke-bright">@{product.nick}</span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Heart size={11} /> {product.jjim}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={11} /> {product.chats}
            </span>
          </div>
          {isOwner && (
            <span className="text-[10px] font-bold text-cuke/70">내 매물 ✏️</span>
          )}
        </div>
      </div>
    </article>
  );
}
