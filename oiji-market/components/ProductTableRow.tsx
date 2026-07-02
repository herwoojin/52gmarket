"use client";

import { useState, useEffect } from "react";
import type { Product } from "@/types";
import { Heart, Pencil } from "lucide-react";
import { loadDriveImg } from "@/lib/driveImage";

interface Props {
  product: Product;
  isJjimed?: boolean;
  currentUid?: string;
  onJjimToggle?: (id: string) => void;
  onClick?: (product: Product) => void;
  onEditClick?: (product: Product) => void;
}

export default function ProductTableRow({ product, isJjimed, currentUid, onJjimToggle, onClick, onEditClick }: Props) {
  const [imgSrc, setImgSrc] = useState("");
  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";
  const isPending = product.status === "입금대기";
  const isOwner = !!currentUid && product.uid === currentUid;

  useEffect(() => {
    let cancelled = false;
    loadDriveImg(product.photoURL).then(src => { if (!cancelled) setImgSrc(src); });
    return () => { cancelled = true; };
  }, [product.photoURL]);

  const statusBadge = isDone
    ? <span className="rounded-md bg-neutral-600/70 px-2 py-0.5 text-[10px] font-bold text-neutral-200">거래완료</span>
    : isPending
    ? <span className="rounded-md bg-amber-500/80 px-2 py-0.5 text-[10px] font-bold text-white">입금대기</span>
    : <span className="rounded-md bg-cuke/20 px-2 py-0.5 text-[10px] font-bold text-cuke">판매중</span>;

  return (
    <tr
      className={`group cursor-pointer border-b border-skin-line transition-colors hover:bg-skin-1 ${isOwner ? "bg-cuke/5" : ""}`}
      onClick={() => onClick?.(product)}
    >
      {/* 썸네일 */}
      <td className="w-12 px-3 py-2">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-skin-2">
          {imgSrc
            ? <img src={imgSrc} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
            : <div className="flex h-full w-full items-center justify-center text-lg opacity-30">🥒</div>
          }
        </div>
      </td>
      {/* 제목 */}
      <td className="max-w-[180px] px-3 py-2">
        <p className="truncate text-[13px] font-semibold text-ink">{product.title}</p>
        <p className="text-[11px] text-muted">@{product.nick}</p>
      </td>
      {/* 가격 */}
      <td className="px-3 py-2 text-[13px] font-bold">
        {isFree
          ? <span className="text-warn">무료나눔</span>
          : <span className="text-ink">{product.price.toLocaleString()}원</span>
        }
      </td>
      {/* 카테고리 */}
      <td className="px-3 py-2 text-[12px] text-muted">{product.category}</td>
      {/* 거래방식 */}
      <td className="px-3 py-2 text-[12px] text-muted">{product.deal}</td>
      {/* 위치 */}
      <td className="px-3 py-2 text-[12px] text-muted">{product.loc}</td>
      {/* 상태 */}
      <td className="px-3 py-2">{statusBadge}</td>
      {/* 등록일 */}
      <td className="px-3 py-2 text-[11px] text-muted">
        {new Date(product.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
      </td>
      {/* 액션 */}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {isOwner ? (
          <button
            onClick={() => onEditClick?.(product)}
            className="flex items-center gap-1 rounded-lg border border-cuke/50 bg-cuke/10 px-2 py-1 text-[11px] font-bold text-cuke hover:bg-cuke/20"
          >
            <Pencil size={10} /> 수정
          </button>
        ) : (
          <button
            onClick={() => onJjimToggle?.(product.id)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
              isJjimed ? "border-cuke bg-cuke text-skin-0" : "border-skin-line text-muted hover:text-cuke"
            }`}
          >
            <Heart size={13} fill={isJjimed ? "currentColor" : "none"} />
          </button>
        )}
      </td>
    </tr>
  );
}
