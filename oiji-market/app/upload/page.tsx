"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createProduct, prependCachedProduct } from "@/lib/sheets";
import { createProductFs } from "@/lib/productsFirestore";
import { isFirebaseEnabled } from "@/lib/firebase";
import { toWebp, formatBytes, savingsPercent } from "@/lib/webp";
import { uploadPhoto } from "@/lib/storage";
import { MAX_PHOTOS, joinPhotoUrls } from "@/lib/driveImage";
import { useNotifications } from "@/lib/notifications";
import { CATEGORIES, LOCATIONS } from "@/types";
import type { NewProduct, Notification, Product } from "@/types";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [deal, setDeal] = useState<"나눔" | "판매">("나눔");
  const [price, setPrice] = useState("");
  const [loc, setLoc] = useState(user?.loc || LOCATIONS[0]);
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 사진 상태 — 최대 MAX_PHOTOS 장
  interface PhotoItem {
    original: File;
    webp: Blob;
    preview: string;
  }
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [converting, setConverting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processImgs = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setConverting(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      if (room <= 0) {
        toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
        return;
      }
      const accepted = files.slice(0, room);
      const converted: PhotoItem[] = [];
      for (const file of accepted) {
        const blob = await toWebp(file);
        converted.push({ original: file, webp: blob, preview: URL.createObjectURL(blob) });
      }
      setPhotos((prev) => [...prev, ...converted]);
      if (files.length > room) {
        toast(`🖼️ ${converted.length}장 변환 완료 (최대 ${MAX_PHOTOS}장까지만 추가돼요)`);
      } else {
        toast(`🖼️ WEBP 변환 완료! (${converted.length}장)`);
      }
    } catch (err) {
      toast.error("이미지 변환에 실패했어요");
      console.error(err);
    } finally {
      setConverting(false);
    }
  }, [photos.length]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) await processImgs(files);
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // 클립보드 붙여넣기 (스크린캡처 Ctrl+V / ⌘V)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgItems = items.filter(it => it.type.startsWith("image/"));
      if (imgItems.length === 0) return;
      const files = imgItems.map(it => it.getAsFile()).filter((f): f is File => !!f);
      if (files.length === 0) return;
      toast("📋 클립보드 이미지 감지!");
      await processImgs(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [processImgs]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    if (deal === "판매" && (!price || Number(price) <= 0)) {
      toast.error("판매 단가를 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      // 사진 여러 장을 순차 업로드해 쉼표로 이어 저장
      const uploaded: string[] = [];
      for (const p of photos) {
        uploaded.push(await uploadPhoto(p.webp, user?.email || "demo-user"));
      }
      const photoURL = joinPhotoUrls(uploaded);

      const item: NewProduct = {
        title: title.trim(),
        category: category as NewProduct["category"],
        deal,
        price: deal === "나눔" ? 0 : Number(price),
        desc: desc.trim(),
        loc,
        nick: user?.nick || "오이박사",
        uid: user?.email || "demo-user",
        photoURL,
      };

      const result = isFirebaseEnabled
        ? await createProductFs(item)
        : await createProduct(item);
      if (result.ok) {
        // 키워드 매칭 알림 체크 (로컬)
        const stored = localStorage.getItem("oiji-keywords");
        if (stored) {
          const keywords: string[] = JSON.parse(stored);
          const matchedKw = keywords.find(
            (kw) => item.title.includes(kw) || item.desc.includes(kw)
          );
          if (matchedKw) {
            const noti: Notification = {
              id: `noti-${Date.now()}`,
              keyword: matchedKw,
              productId: result.id || "",
              title: item.title,
              loc: item.loc,
              unread: true,
              createdAt: new Date().toISOString(),
            };
            addNotification(noti);
            toast(`🔔 '${matchedKw}' 키워드 매물 알림!`);
          }
        }

        // CDN 캐시가 최대 60초 낡을 수 있으므로, 방금 올린 매물은
        // 로컬 목록 맨 앞에 즉시 반영해 바로 보이도록 한다.
        const optimistic: Product = {
          ...item,
          id: result.id || `p${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: "판매중",
          jjim: 0,
          chats: 0,
        };
        prependCachedProduct(optimistic);
        queryClient.setQueryData<Product[]>(["products"], (prev) =>
          prev ? [optimistic, ...prev] : [optimistic]
        );
        toast("🥒 매물을 올렸어요!");
        router.push("/");
      } else {
        const msg = (result as { ok: false; error?: string }).error;
        toast.error(msg === "unauthorized"
          ? "앱 토큰 설정이 필요해요. 관리자에게 문의하세요."
          : `등록 실패: ${msg || "알 수 없는 오류"}`);
      }
    } catch (err) {
      toast.error("등록에 실패했어요. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in px-4 pt-5 pb-8">
      <h2 className="mb-6 text-xl font-extrabold tracking-tight">매물 올리기</h2>

      {/* 사진 */}
      <div className="mb-5">
        <label className="mb-2 block text-[13px] font-bold">
          사진 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        {photos.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-oiji border-2 border-dashed border-skin-line bg-skin-1 px-6 py-8 text-center transition-colors hover:border-cuke/50 active:border-cuke"
          >
            <Camera size={34} className="mx-auto mb-2 text-muted" />
            <p className="text-[14px] font-bold text-ink">사진 선택 또는 촬영</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-skin-2 px-3 py-1.5 text-[11.5px] font-semibold text-cuke-bright">
              <Upload size={11} />
              스크린샷은 <kbd className="rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-white">⌘V</kbd> / <kbd className="rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-white">Ctrl+V</kbd> 로 바로 붙여넣기
            </p>
            <p className="mt-2 text-[11px] text-muted">
              자동으로 WEBP 변환 · 최대 {MAX_PHOTOS}장
            </p>
          </button>
        ) : (
          <div className="rounded-oiji border border-skin-line bg-skin-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-ink">
                사진 {photos.length}/{MAX_PHOTOS}장
                <span className="ml-1.5 text-[11px] font-normal text-muted">
                  첫 번째 사진이 대표 이미지예요
                </span>
              </p>
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-cuke/50 bg-cuke/10 px-2.5 py-1 text-[11px] font-bold text-cuke"
                >
                  + 사진 추가
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt={`미리보기 ${i + 1}`}
                    className="aspect-square w-full rounded-xl border border-skin-line object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-md bg-cuke px-1.5 py-0.5 text-[9px] font-extrabold text-skin-0">
                      대표
                    </span>
                  )}
                  <button
                    onClick={() => removePhoto(i)}
                    aria-label={`사진 ${i + 1} 삭제`}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-bold text-white"
                  >
                    ×
                  </button>
                  <p className="mt-1 text-center text-[10px] text-muted">
                    {formatBytes(p.webp.size)}
                    <span className="ml-1 text-cuke-bright">
                      -{savingsPercent(p.original.size, p.webp.size)}%
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {converting && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            <Loader2 size={14} className="animate-spin" /> WEBP 변환 중...
          </div>
        )}
      </div>

      {/* 제목 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: HP 26A 토너 미개봉"
          className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        />
      </div>

      {/* 카테고리 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">카테고리</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* 거래방식 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">거래방식</label>
        <div className="flex gap-2">
          {(["나눔", "판매"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDeal(d)}
              className={`flex-1 rounded-xl border px-4 py-3.5 text-[14px] font-bold transition-all ${
                deal === d
                  ? "border-cuke bg-cuke text-skin-0"
                  : "border-skin-line bg-skin-1 text-muted"
              }`}
            >
              {d === "나눔" ? "🎁 나눔" : "💰 판매"}
            </button>
          ))}
        </div>
      </div>

      {/* 단가 (판매시) */}
      {deal === "판매" && (
        <div className="mb-4">
          <label className="mb-2 block text-[13px] font-bold">단가 (원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
          />
        </div>
      )}

      {/* 근무지 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">픽업 위치</label>
        <select
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        >
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* 설명 */}
      <div className="mb-6">
        <label className="mb-2 block text-[13px] font-bold">
          설명 <span className="font-normal text-muted">(선택)</span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="상품 상태, 수량 등을 적어주세요"
          className="w-full resize-y rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] leading-relaxed text-ink outline-none transition-colors focus:border-cuke"
        />
      </div>

      {/* 등록 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={submitting || converting}
        className="w-full rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98] disabled:opacity-40"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> 등록 중...
          </span>
        ) : (
          "🥒 매물 올리기"
        )}
      </button>
    </div>
  );
}
