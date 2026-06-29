"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProducts, updateProduct } from "@/lib/sheets";
import ProductCard from "@/components/ProductCard";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import ChatSheet from "@/components/ChatSheet";
import type { Product } from "@/types";
import { CATEGORIES, DEALS } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });

  const [catFilter, setCatFilter] = useState<string>("전체");
  const [dealFilter, setDealFilter] = useState<string>("전체");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [jjimedIds, setJjimedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return products
      .filter((p) => p.status !== "삭제")
      .filter((p) => catFilter === "전체" || p.category === catFilter)
      .filter((p) => dealFilter === "전체" || p.deal === dealFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, catFilter, dealFilter]);

  const handleJjimToggle = async (id: string) => {
    setJjimedIds((prev) => {
      const next = new Set(prev);
      const wasJjimed = next.has(id);
      if (wasJjimed) next.delete(id);
      else next.add(id);

      // 시트 찜 수 갱신
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
              onJjimToggle={handleJjimToggle}
              onClick={setSelectedProduct}
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

      {/* 상세 시트 */}
      <ProductDetailSheet
        product={selectedProduct}
        isOpen={!!selectedProduct}
        isJjimed={selectedProduct ? jjimedIds.has(selectedProduct.id) : false}
        onClose={() => setSelectedProduct(null)}
        onJjimToggle={handleJjimToggle}
        onChat={(p) => {
          setSelectedProduct(null);
          setChatProduct(p);
        }}
        onPay={(p) => {
          toast("💳 결제 기능은 토스페이먼츠 키 설정 후 사용 가능해요");
        }}
      />

      {/* 채팅 시트 */}
      <ChatSheet
        product={chatProduct}
        isOpen={!!chatProduct}
        onClose={() => setChatProduct(null)}
        currentNick={profile.nick}
        currentUid="demo-user"
      />
    </div>
  );
}
