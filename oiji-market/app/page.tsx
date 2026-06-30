"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProducts, updateProduct, removeProduct, getLastModified } from "@/lib/sheets";
import ProductCard from "@/components/ProductCard";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import ChatSheet from "@/components/ChatSheet";
import type { Product } from "@/types";
import { CATEGORIES, DEALS } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    staleTime: 0,
  });

  const [catFilter, setCatFilter] = useState<string>("전체");
  const [dealFilter, setDealFilter] = useState<string>("전체");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  // localStorage에서 이 유저의 찜 목록 복원
  const jjimKey = `oiji-jjim-${user?.email ?? "guest"}`;
  const [jjimedIds, setJjimedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(jjimKey);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  /* ── 실시간 동기화: 10초마다 ping → 시트 변경 감지 시 즉시 리프레시 ── */
  const lastModifiedRef = useRef<number>(0);

  const { data: lastModified = 0 } = useQuery({
    queryKey: ["ping"],
    queryFn: getLastModified,
    refetchInterval: 10_000,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (!lastModified) return;
    if (lastModifiedRef.current === 0) {
      // 첫 로드 — 기준점 저장
      lastModifiedRef.current = lastModified;
      return;
    }
    if (lastModified > lastModifiedRef.current) {
      lastModifiedRef.current = lastModified;
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast("🥒 시트가 업데이트됐어요!", { duration: 2000 });
    }
  }, [lastModified, queryClient]);

  const filtered = useMemo(() => {
    return products
      .filter((p) => p.status !== "삭제")
      .filter((p) => catFilter === "전체" || p.category === catFilter)
      .filter((p) => dealFilter === "전체" || p.deal === dealFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, catFilter, dealFilter]);

  const handleUpdate = async (id: string, patch: Partial<(typeof products)[0]>) => {
    await updateProduct(id, patch);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast("🥒 매물을 수정했어요!");
  };

  const handleDelete = async (id: string) => {
    await removeProduct(id);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setSelectedProduct(null);
    toast("매물을 삭제했어요");
  };

  const handleJjimToggle = async (id: string) => {
    setJjimedIds((prev) => {
      const next = new Set(prev);
      const wasJjimed = next.has(id);
      if (wasJjimed) next.delete(id);
      else next.add(id);

      // localStorage 영구 저장 (유저별)
      try {
        localStorage.setItem(jjimKey, JSON.stringify(Array.from(next)));
      } catch { /* 무시 */ }

      const product = products.find((p) => p.id === id);
      if (product) {
        updateProduct(id, { jjim: product.jjim + (wasJjimed ? -1 : 1) });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }

      toast(wasJjimed ? "항아리에서 꺼냈어요" : "🥒 항아리에 담았어요!");
      return next;
    });
  };

  return (
    <div className="animate-fade-in px-4 pt-4 pb-2">
      {/* 카테고리 필터 */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {["전체", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all ${
              catFilter === cat
                ? "border-cuke bg-cuke text-skin-0"
                : "border-skin-line bg-skin-1 text-muted hover:border-cuke/50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 거래방식 필터 */}
      <div className="mb-4 flex gap-2">
        {DEALS.map((deal) => (
          <button
            key={deal}
            onClick={() => setDealFilter(deal)}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all ${
              dealFilter === deal
                ? "border-cuke bg-cuke text-skin-0"
                : "border-skin-line bg-skin-1 text-muted hover:border-cuke/50"
            }`}
          >
            {deal}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cuke border-t-transparent" />
        </div>
      )}

      {/* 매물 그리드 */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isJjimed={jjimedIds.has(product.id)}
              currentUid={user?.email || ""}
              onJjimToggle={handleJjimToggle}
              onClick={(p) => { setOpenInEditMode(false); setSelectedProduct(p); }}
              onEditClick={(p) => { setOpenInEditMode(true); setSelectedProduct(p); }}
            />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">🥒</span>
          <p className="text-[15px] font-bold text-muted">매물이 없어요</p>
          <p className="text-[13px] text-muted">
            안 쓰는 물건을 올려보세요!
          </p>
        </div>
      )}

      {/* 상세 시트 — key가 바뀌면 state 자동 리셋 (편집/뷰 모드 전환 포함) */}
      <ProductDetailSheet
        key={`${selectedProduct?.id ?? "closed"}-${openInEditMode ? "e" : "v"}`}
        product={selectedProduct}
        isOpen={!!selectedProduct}
        isJjimed={selectedProduct ? jjimedIds.has(selectedProduct.id) : false}
        currentUid={user?.email || ""}
        initialEditMode={openInEditMode}
        onClose={() => { setSelectedProduct(null); setOpenInEditMode(false); }}
        onJjimToggle={handleJjimToggle}
        onChat={(p) => {
          setSelectedProduct(null);
          setChatProduct(p);
        }}
        onPay={() => {
          toast("💳 결제 기능은 토스페이먼츠 키 설정 후 사용 가능해요");
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* 채팅 시트 — key가 바뀌면 state 자동 리셋 */}
      <ChatSheet
        key={chatProduct?.id ?? "closed"}
        product={chatProduct}
        isOpen={!!chatProduct}
        onClose={() => setChatProduct(null)}
        currentNick={user?.nick || "오이박사"}
        currentUid={user?.email || "demo-user"}
      />
    </div>
  );
}
