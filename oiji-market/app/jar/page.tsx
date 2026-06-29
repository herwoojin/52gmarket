"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, updateProduct } from "@/lib/sheets";
import ProductCard from "@/components/ProductCard";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import type { Product } from "@/types";
import { toast } from "sonner";

export default function JarPage() {
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });

  const [jjimedIds, setJjimedIds] = useState<Set<string>>(() => {
    // localStorage에서 복원
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("oiji-jjimed");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const jarProducts = useMemo(
    () => products.filter((p) => jjimedIds.has(p.id) && p.status !== "삭제"),
    [products, jjimedIds]
  );

  const handleJjimToggle = async (id: string) => {
    setJjimedIds((prev) => {
      const next = new Set(prev);
      const wasJjimed = next.has(id);
      if (wasJjimed) next.delete(id);
      else next.add(id);
      localStorage.setItem("oiji-jjimed", JSON.stringify([...next]));

      const product = products.find((p) => p.id === id);
      if (product) {
        updateProduct(id, { jjim: product.jjim + (wasJjimed ? -1 : 1) });
      }

      toast(wasJjimed ? "항아리에서 꺼냈어요" : "🥒 항아리에 담았어요!");
      return next;
    });
  };

  return (
    <div className="animate-fade-in px-4 pt-4 pb-2">
      {/* 히어로 */}
      <div className="mb-4 flex items-center gap-4 rounded-oiji border border-skin-line bg-gradient-to-br from-skin-2 to-skin-1 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center text-5xl">
          🏺
        </div>
        <div>
          <h2 className="text-[17px] font-extrabold tracking-tight">오이지 항아리</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            마음에 든 매물을 <b className="text-cuke-bright">찜(=오이지 담그기)</b>해서
            모아두세요.
          </p>
        </div>
      </div>

      {/* 카운트 */}
      <p className="mb-3 text-[13px] font-bold text-muted">
        담근 매물 <span className="text-cuke-bright">{jarProducts.length}</span>개
      </p>

      {jarProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {jarProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isJjimed={true}
              onJjimToggle={handleJjimToggle}
              onClick={setSelectedProduct}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">🏺</span>
          <p className="text-[15px] font-bold text-muted">항아리가 비었어요</p>
          <p className="text-[13px] text-muted">
            홈에서 마음에 드는 매물의 ♡를 눌러 담아보세요!
          </p>
        </div>
      )}

      <ProductDetailSheet
        product={selectedProduct}
        isOpen={!!selectedProduct}
        isJjimed={selectedProduct ? jjimedIds.has(selectedProduct.id) : false}
        onClose={() => setSelectedProduct(null)}
        onJjimToggle={handleJjimToggle}
      />
    </div>
  );
}
