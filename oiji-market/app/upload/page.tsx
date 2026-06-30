"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createProduct } from "@/lib/sheets";
import { toWebp, formatBytes, savingsPercent } from "@/lib/webp";
import { uploadPhoto } from "@/lib/storage";
import { useNotifications } from "@/lib/notifications";
import { CATEGORIES, LOCATIONS } from "@/types";
import type { NewProduct, Notification } from "@/types";
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

  // 사진 상태
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [webpBlob, setWebpBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [converting, setConverting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOriginalFile(file);
    setConverting(true);

    try {
      const blob = await toWebp(file);
      setWebpBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      toast("🖼️ WEBP 변환 완료!");
    } catch (err) {
      toast.error("이미지 변환에 실패했어요");
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

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
      let photoURL = "";
      if (webpBlob) {
        photoURL = await uploadPhoto(webpBlob, user?.email || "demo-user");
      }

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

      const result = await createProduct(item);
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

        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast("🥒 매물을 올렸어요!");
        router.push("/");
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
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        {!previewUrl ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-oiji border-2 border-dashed border-skin-line bg-skin-1 px-6 py-8 text-center transition-colors active:border-cuke"
          >
            <Camera size={34} className="mx-auto mb-2 text-muted" />
            <p className="text-[14px] font-bold text-ink">사진 선택 또는 촬영</p>
            <p className="mt-1 text-[11.5px] text-muted">자동으로 WEBP 변환됩니다</p>
          </button>
        ) : (
          <div className="flex gap-3 rounded-oiji border border-skin-line bg-skin-1 p-3">
            <img
              src={previewUrl}
              alt="미리보기"
              className="h-22 w-22 shrink-0 rounded-xl border border-skin-line object-cover"
            />
            <div className="flex-1 text-[12px] leading-relaxed">
              {originalFile && (
                <>
                  <p>
                    원본:{" "}
                    <span className="rounded-md bg-skin-2 px-1.5 py-0.5 text-[11px]">
                      {formatBytes(originalFile.size)}
                    </span>
                  </p>
                  {webpBlob && (
                    <>
                      <p className="mt-1">
                        변환:{" "}
                        <span className="rounded-md bg-skin-2 px-1.5 py-0.5 text-[11px]">
                          {formatBytes(webpBlob.size)}
                        </span>
                      </p>
                      <p className="mt-1 font-extrabold text-cuke-bright">
                        🎉 {savingsPercent(originalFile.size, webpBlob.size)}% 절감
                      </p>
                    </>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  setOriginalFile(null);
                  setWebpBlob(null);
                  setPreviewUrl("");
                }}
                className="mt-2 text-[11px] text-muted underline"
              >
                다시 선택
              </button>
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
