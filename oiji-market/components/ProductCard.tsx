"use client";

import type { Product } from "@/types";
import { Heart, MapPin, MessageCircle, Pencil } from "lucide-react";
import { parsePhotoUrls } from "@/lib/driveImage";
import ProductImage from "@/components/ProductImage";

interface ProductCardProps {
  product: Product;
  isJjimed?: boolean;
  currentUid?: string;
  variant?: "large" | "small";
  onJjimToggle?: (id: string) => void;
  onClick?: (product: Product) => void;
  onEditClick?: (product: Product) => void;
}

export default function ProductCard({
  product,
  isJjimed = false,
  currentUid,
  variant = "large",
  onJjimToggle,
  onClick,
  onEditClick,
}: ProductCardProps) {
  const isSmall = variant === "small";
  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";
  const isOwner = !!currentUid && product.uid === currentUid;




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
        <ProductImage
          url={parsePhotoUrls(product.photoURL)[0]}
          alt={product.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          fallback={
            <div className="flex h-full w-full items-center justify-center text-4xl opacity-40">
              🥒
            </div>
          }
        />

        {/* 사진 장수 배지 */}
        {parsePhotoUrls(product.photoURL).length > 1 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
            📷 {parsePhotoUrls(product.photoURL).length}
          </span>
        )}

        {/* 우상단 버튼: 내 매물이면 편집, 아니면 찜 */}
        {isOwner ? (
          <div className="absolute right-2 top-2 group/edittip">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditClick?.(product);
              }}
              className="flex items-center gap-1 rounded-xl border border-cuke bg-cuke/90 px-2.5 py-1.5 text-[11px] font-bold text-skin-0 shadow-md backdrop-blur-sm transition-all hover:bg-cuke active:scale-95"
            >
              <Pencil size={11} />
              수정
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-30 hidden rounded-lg bg-neutral-900/90 px-2.5 py-1.5 text-[11px] text-white whitespace-nowrap shadow-lg group-hover/edittip:block">
              클릭하면 내용·사진을 수정할 수 있어요
            </div>
          </div>
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
      <div className={isSmall ? "p-1.5 pb-2" : "p-2.5 pb-3"}>
        <h3 className={`font-bold leading-snug tracking-tight ${isSmall ? "line-clamp-1 text-[11px]" : "line-clamp-2 min-h-[35px] text-[13.5px]"}`}>
          {product.title}
        </h3>

        <p className={`font-extrabold ${isFree ? "text-warn" : "text-ink"} ${isSmall ? "mt-0.5 text-[11px]" : "mt-1.5 text-[15px]"}`}>
          {isFree ? "무료" : `${product.price.toLocaleString()}원`}
        </p>

        {!isSmall && (
          <>
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
                <div className="group/ownertip relative">
                  <span className="inline-flex items-center rounded-full border border-cuke/30 bg-cuke/10 px-2 py-0.5 text-[10px] font-bold text-cuke/80">
                    내 매물
                  </span>
                  <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 z-30 hidden rounded-lg bg-neutral-900/90 px-2.5 py-1.5 text-[11px] text-white whitespace-nowrap shadow-lg group-hover/ownertip:block">
                    내가 등록한 매물 — 우상단 수정 버튼으로 편집
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
