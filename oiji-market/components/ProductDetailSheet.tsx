"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { CATEGORIES, LOCATIONS } from "@/types";
import { Heart, MessageCircle, MapPin, Tag, X, CreditCard, Pencil, Trash2, Loader2 } from "lucide-react";
import { uploadPhoto } from "@/lib/storage";
import { toWebp } from "@/lib/webp";

interface ProductDetailSheetProps {
  product: Product | null;
  isOpen: boolean;
  isJjimed?: boolean;
  currentUid?: string;
  initialEditMode?: boolean;
  onClose: () => void;
  onJjimToggle?: (id: string) => void;
  onChat?: (product: Product) => void;
  onPay?: (product: Product) => void;
  onUpdate?: (id: string, patch: Partial<Product>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function ProductDetailSheet({
  product,
  isOpen,
  isJjimed = false,
  currentUid,
  initialEditMode = false,
  onClose,
  onJjimToggle,
  onChat,
  onPay,
  onUpdate,
  onDelete,
}: ProductDetailSheetProps) {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailImgError, setDetailImgError] = useState(false);

  function normalizeDriveUrl(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("blob:") || url === "이미지 보기" || url === "이미지링크") return "";
    if (url.includes("drive.google.com/thumbnail")) {
      const m = url.match(/id=([^&]+)/);
      if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    }
    return url;
  }
  const resolvedDetailUrl = normalizeDriveUrl(product?.photoURL);

  // 편집 폼 상태
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [deal, setDeal] = useState<"나눔" | "판매">("나눔");
  const [price, setPrice] = useState("");
  const [loc, setLoc] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"판매중" | "거래완료">("판매중");
  const [photoURL, setPhotoURL] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !product) return null;

  const isOwner = !!currentUid && product.uid === currentUid;
  const isFree = product.deal === "나눔";
  const isDone = product.status === "거래완료";

  const openEdit = () => {
    setTitle(product.title);
    setCategory(product.category);
    setDeal(product.deal as "나눔" | "판매");
    setPrice(String(product.price || ""));
    setLoc(product.loc);
    setDesc(product.desc || "");
    setStatus(product.status as "판매중" | "거래완료");
    setPhotoURL(product.photoURL || "");
    setPreviewUrl(product.photoURL || "");
    setPhotoBlob(null);
    setEditMode(true);
  };

  const handleClose = () => {
    setEditMode(false);
    setConfirmDelete(false);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await toWebp(file);
      setPhotoBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPhotoBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let finalPhotoURL = photoURL;
      if (photoBlob) {
        finalPhotoURL = await uploadPhoto(photoBlob, currentUid || "demo");
      }
      await onUpdate?.(product.id, {
        title: title.trim(),
        category: category as Product["category"],
        deal,
        price: deal === "나눔" ? 0 : Number(price) || 0,
        loc,
        desc: desc.trim(),
        status,
        photoURL: finalPhotoURL,
      });
      setEditMode(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(product.id);
      setConfirmDelete(false);
      setEditMode(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* 오버레이 */}
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* 시트 */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-[920px] animate-slide-up rounded-t-3xl border-t border-skin-line bg-skin-1 shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* 핸들 */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-skin-line" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pb-1">
          <p className="text-[13px] font-bold text-muted">
            {editMode ? "매물 수정" : isOwner ? "내 매물" : "매물 상세"}
          </p>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-skin-2 text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {/* ───────── 편집 모드 ───────── */}
        {editMode ? (
          <div className="overflow-y-auto px-5 pb-40" style={{ maxHeight: "calc(90vh - 80px)" }}>
            {/* 사진 */}
            <div className="mb-4">
              <label className="mb-2 block text-[13px] font-bold">사진</label>
              <div className="relative overflow-hidden rounded-2xl bg-skin-2" style={{ aspectRatio: "4/3" }}>
                {previewUrl ? (
                  <img src={previewUrl} alt="미리보기" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl opacity-20">🥒</div>
                )}
                <label className="absolute inset-0 flex cursor-pointer items-end justify-center bg-gradient-to-t from-black/60 to-transparent">
                  <span className="mb-3 rounded-xl bg-black/60 px-4 py-1.5 text-[12px] font-bold text-white">
                    {uploading ? "변환 중..." : "사진 변경 (클릭)"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
              </div>
            </div>

            {/* 제목 */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-bold">제목 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
              />
            </div>

            {/* 카테고리 */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-bold">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* 거래방식 */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-bold">거래방식</label>
              <div className="flex gap-2">
                {(["나눔", "판매"] as const).map((d) => (
                  <button key={d} onClick={() => setDeal(d)}
                    className={`flex-1 rounded-xl border py-3 text-[13px] font-bold transition-all ${
                      deal === d ? "border-cuke bg-cuke text-skin-0" : "border-skin-line text-muted"
                    }`}
                  >
                    {d === "나눔" ? "🎁 나눔" : "💰 판매"}
                  </button>
                ))}
              </div>
            </div>

            {/* 단가 */}
            {deal === "판매" && (
              <div className="mb-3">
                <label className="mb-1.5 block text-[13px] font-bold">단가 (원)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
                />
              </div>
            )}

            {/* 픽업 위치 */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-bold">픽업 위치</label>
              <select
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
              >
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>

            {/* 상태 */}
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] font-bold">판매 상태</label>
              <div className="flex gap-2">
                {(["판매중", "거래완료"] as const).map((s) => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex-1 rounded-xl border py-3 text-[13px] font-bold transition-all ${
                      status === s ? "border-cuke bg-cuke text-skin-0" : "border-skin-line text-muted"
                    }`}
                  >
                    {s === "판매중" ? "🟢 판매중" : "✅ 거래완료"}
                  </button>
                ))}
              </div>
            </div>

            {/* 설명 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-bold">설명</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-skin-line bg-skin-1 px-4 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-cuke"
              />
            </div>

            {/* 삭제 */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 py-3.5 text-[13px] font-bold text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={15} /> 이 매물 삭제하기
              </button>
            ) : (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                <p className="mb-3 text-center text-[13px] font-bold text-red-400">
                  정말 삭제할까요? 복구할 수 없어요.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-xl border border-skin-line py-2.5 text-[13px] font-bold text-muted">
                    취소
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-500 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ───────── 상세 보기 모드 ───────── */
          <div className="overflow-y-auto px-5 pb-36" style={{ maxHeight: "calc(90vh - 80px)" }}>
            <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-2xl bg-skin-2">
              {resolvedDetailUrl && !detailImgError ? (
                <img src={resolvedDetailUrl} alt={product.title} className="h-full w-full object-cover" onError={() => setDetailImgError(true)} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-7xl opacity-30">🥒</div>
              )}
              {isDone && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="rounded-xl bg-neutral-600 px-6 py-3 text-lg font-extrabold text-white">거래완료</span>
                </div>
              )}
            </div>

            <h2 className="text-xl font-extrabold leading-tight tracking-tight">{product.title}</h2>
            <p className={`mt-2 text-2xl font-extrabold ${isFree ? "text-warn" : "text-ink"}`}>
              {isFree ? "무료나눔 🎁" : `${product.price.toLocaleString()}원`}
            </p>

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

            <div className="mt-3 flex gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1"><Heart size={12} /> 찜 {product.jjim}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> 대화 {product.chats}</span>
            </div>

            <div className="mt-5 rounded-2xl bg-skin-2 p-4">
              <h3 className="mb-2 text-[13px] font-bold text-muted">상품 설명</h3>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {product.desc || "설명이 없어요."}
              </p>
            </div>
          </div>
        )}

        {/* ───────── 하단 버튼 ───────── */}
        <div
          className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-w-[920px] flex gap-3 border-t border-skin-line bg-skin-1 px-5 py-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setConfirmDelete(false); }}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-skin-line bg-skin-2 text-[15px] font-bold text-muted">
                취소
              </button>
              <button onClick={handleSave} disabled={saving || !title.trim()}
                className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-cuke text-[15px] font-extrabold text-skin-0 disabled:opacity-40">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Pencil size={18} />}
                수정 완료
              </button>
            </>
          ) : isOwner ? (
            <>
              <button onClick={openEdit}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-cuke/60 bg-cuke/10 text-[15px] font-bold text-cuke transition-colors hover:bg-cuke/20">
                <Pencil size={18} /> 수정하기
              </button>
              <button onClick={() => { openEdit(); setTimeout(() => setConfirmDelete(true), 0); }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/30 text-red-400 hover:bg-red-500/10">
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onJjimToggle?.(product.id)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                  isJjimed ? "border-cuke bg-cuke text-skin-0" : "border-skin-line bg-skin-2 text-muted hover:text-cuke"
                }`}
              >
                <Heart size={20} fill={isJjimed ? "currentColor" : "none"} />
              </button>
              <button onClick={() => onChat?.(product)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-2 text-[15px] font-bold text-ink hover:border-cuke">
                <MessageCircle size={18} /> 대화하기
              </button>
              {!isFree && !isDone && (
                <button onClick={() => onPay?.(product)}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-pay text-[15px] font-bold text-white hover:bg-pay/90">
                  <CreditCard size={18} /> 결제하기
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </>
  );
}
