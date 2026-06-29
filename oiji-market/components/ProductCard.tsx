"use client";

import type { Product } from "@/types";
import { Heart, MapPin, MessageCircle } from "lucide-react";

interface ProductCardProps {
  product: Product;
  isJjimed?: boolean;
  onJjimToggle?: (id: string) => void;
  onClick?: (product: Product) => void;
}

export default function ProductCard({
  product,
  isJjimed = false,
  onJjimToggle,
  onClick,
}: ProductCardProps) {
  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";

  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-oiji border border-skin-line bg-skin-1 transition-all hover:border-cuke/30 active:scale-[0.98]"
      onClick={() => onClick?.(product)}
    >
      {/* 썸네일 */}
      <div className="relative aspect-square overflow-hidden bg-skin-2">
        {product.photoURL ? (
          <img
            src={product.photoURL}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
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

        {/* 찜 버튼 */}
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

        <div className="mt-2 flex gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Heart size={11} /> {product.jjim}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} /> {product.chats}
          </span>
        </div>
      </div>
    </article>
  );
}
