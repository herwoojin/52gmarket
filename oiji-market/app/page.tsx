"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProducts, updateProduct, removeProduct, getLastModified, getCachedProducts } from "@/lib/sheets";
import ProductCard from "@/components/ProductCard";
import ProductTableRow from "@/components/ProductTableRow";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import ChatSheet from "@/components/ChatSheet";
import PaymentSheet from "@/components/PaymentSheet";
import HomeLoadingMascot from "@/components/HomeLoadingMascot";
import type { Product } from "@/types";
import { CATEGORIES, DEALS, LOCATIONS } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { LayoutGrid, Grid3X3, Table2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export default function HomePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // 캐시된 매물이 있으면 즉시 보여주고 새 데이터는 백그라운드에서 갱신.
  // Apps Script가 5~70초로 매우 느려 첫 화면 체감 속도를 위해 필수.
  const [cachedSeed] = useState<Product[]>(() => getCachedProducts());
  const { data: products = [], isLoading, isFetching } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
    staleTime: 0,
    ...(cachedSeed.length > 0
      ? { initialData: cachedSeed, initialDataUpdatedAt: 0 }
      : {}),
  });

  const [catFilter, setCatFilter] = useState<string>("전체");
  const [dealFilter, setDealFilter] = useState<string>("전체");
  const [locFilter, setLocFilter] = useState<string>("전체");
  const [statusFilter, setStatusFilter] = useState<string>("판매중");
  const [viewMode, setViewMode] = useState<"large" | "small" | "table">(() => {
    if (typeof window === "undefined") return "large";
    return (localStorage.getItem("oiji-view") as "large" | "small" | "table") || "large";
  });
  const [sortCol, setSortCol] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [payProduct, setPayProduct] = useState<Product | null>(null);
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

  // Apps Script 는 동시 실행 수가 제한돼 요청이 몰리면 서로를 지연시킨다.
  // 핵심인 매물 조회가 끝난 뒤에만, 넉넉한 주기로 폴링한다.
  const { data: lastModified = 0 } = useQuery({
    queryKey: ["ping"],
    queryFn: getLastModified,
    enabled: !isFetching,
    refetchInterval: 60_000,
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
      .filter((p) => locFilter === "전체" || p.loc === locFilter)
      .filter((p) => statusFilter === "전체" || p.status === statusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [products, catFilter, dealFilter, locFilter, statusFilter]);

  const sorted = useMemo(() => {
    if (viewMode !== "table") return filtered;
    return [...filtered].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortCol === "title")     { va = a.title;     vb = b.title; }
      else if (sortCol === "price")    { va = a.price;     vb = b.price; }
      else if (sortCol === "category") { va = a.category;  vb = b.category; }
      else if (sortCol === "deal")     { va = a.deal;      vb = b.deal; }
      else if (sortCol === "loc")      { va = a.loc;       vb = b.loc; }
      else if (sortCol === "status")   { va = a.status;    vb = b.status; }
      else { va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, viewMode, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const changeView = (mode: "large" | "small" | "table") => {
    setViewMode(mode);
    localStorage.setItem("oiji-view", mode);
  };

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
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const wasJjimed = jjimedIds.has(id);

    // 1. 로컬 상태 업데이트 (즉시 UI 반영)
    setJjimedIds((prev) => {
      const next = new Set(prev);
      if (wasJjimed) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(jjimKey, JSON.stringify(Array.from(next)));
      } catch { /* 무시 */ }
      return next;
    });

    toast(wasJjimed ? "항아리에서 꺼냈어요" : "🥒 항아리에 담았어요!");

    // 2. 시트 카운터 업데이트 (음수 방지)
    const newJjim = Math.max(0, (product.jjim ?? 0) + (wasJjimed ? -1 : 1));
    await updateProduct(id, { jjim: newJjim });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ChevronsUpDown size={12} className="ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="ml-1 inline text-cuke" />
      : <ChevronDown size={12} className="ml-1 inline text-cuke" />;
  };

  const TABLE_COLS: { key: string; label: string; sortable: boolean }[] = [
    { key: "_img",     label: "",       sortable: false },
    { key: "title",    label: "제목",   sortable: true },
    { key: "price",    label: "가격",   sortable: true },
    { key: "category", label: "카테고리", sortable: true },
    { key: "deal",     label: "거래방식", sortable: true },
    { key: "loc",      label: "위치",   sortable: true },
    { key: "status",   label: "상태",   sortable: true },
    { key: "createdAt",label: "등록일", sortable: true },
    { key: "_action",  label: "",       sortable: false },
  ];

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

      {/* 거래방식 + 판매상태 + 위치 필터 + 보기모드 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <span className="h-5 w-px bg-skin-line" />

        {(["전체", "판매중", "거래완료"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all ${
              statusFilter === s
                ? s === "거래완료"
                  ? "border-neutral-500 bg-neutral-600 text-neutral-100"
                  : "border-cuke bg-cuke text-skin-0"
                : "border-skin-line bg-skin-1 text-muted hover:border-cuke/50"
            }`}
          >
            {s === "전체" ? "전체" : s === "판매중" ? "🟢 판매중" : "✅ 거래완료"}
          </button>
        ))}

        {/* 위치 드롭다운 */}
        <select
          value={locFilter}
          onChange={(e) => setLocFilter(e.target.value)}
          className={`appearance-none rounded-full border px-3.5 py-2 text-[13px] font-semibold outline-none transition-all ${
            locFilter !== "전체"
              ? "border-cuke bg-cuke text-skin-0"
              : "border-skin-line bg-skin-1 text-muted"
          }`}
        >
          <option value="전체">📍 전체 위치</option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        {/* 보기 모드 토글 */}
        <div className="ml-auto flex rounded-xl border border-skin-line bg-skin-1 p-0.5">
          {([
            { mode: "large", icon: <LayoutGrid size={15} />, label: "크게" },
            { mode: "small", icon: <Grid3X3 size={15} />,   label: "작게" },
            { mode: "table", icon: <Table2 size={15} />,    label: "표" },
          ] as const).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => changeView(mode)}
              title={`${label} 보기`}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all ${
                viewMode === mode
                  ? "bg-cuke text-skin-0 shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && <HomeLoadingMascot />}

      {/* 캐시를 보여주는 중 백그라운드 갱신 알림 */}
      {!isLoading && isFetching && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-cuke/10 px-3 py-2 text-[12px] font-semibold text-cuke">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cuke/30 border-t-cuke" />
          최신 매물을 불러오는 중이에요 — 지금 보이는 건 이전 목록이에요
        </div>
      )}

      {/* ── 크게 보기 ── */}
      {!isLoading && viewMode === "large" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((product) => (
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

      {/* ── 작게 보기 ── */}
      {!isLoading && viewMode === "small" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {sorted.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="small"
              isJjimed={jjimedIds.has(product.id)}
              currentUid={user?.email || ""}
              onJjimToggle={handleJjimToggle}
              onClick={(p) => { setOpenInEditMode(false); setSelectedProduct(p); }}
              onEditClick={(p) => { setOpenInEditMode(true); setSelectedProduct(p); }}
            />
          ))}
        </div>
      )}

      {/* ── 표 보기 ── */}
      {!isLoading && viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-skin-line">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-skin-line bg-skin-1">
                {TABLE_COLS.map(({ key, label, sortable }) => (
                  <th
                    key={key}
                    onClick={() => sortable && handleSort(key)}
                    className={`px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted ${
                      sortable ? "cursor-pointer select-none hover:text-ink" : ""
                    }`}
                  >
                    {label}
                    {sortable && <SortIcon col={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  isJjimed={jjimedIds.has(product.id)}
                  currentUid={user?.email || ""}
                  onJjimToggle={handleJjimToggle}
                  onClick={(p) => { setOpenInEditMode(false); setSelectedProduct(p); }}
                  onEditClick={(p) => { setOpenInEditMode(true); setSelectedProduct(p); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">🥒</span>
          <p className="text-[15px] font-bold text-muted">매물이 없어요</p>
          <p className="text-[13px] text-muted">안 쓰는 물건을 올려보세요!</p>
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
        onPay={(p) => {
          setSelectedProduct(null);
          setPayProduct(p);
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* 채팅 시트 */}
      <ChatSheet
        key={chatProduct?.id ?? "closed"}
        product={chatProduct}
        isOpen={!!chatProduct}
        onClose={() => setChatProduct(null)}
        currentNick={user?.nick || "오이박사"}
        currentUid={user?.email || "demo-user"}
      />

      {/* 결제 시트 */}
      <PaymentSheet
        key={payProduct?.id ?? "pay-closed"}
        product={payProduct}
        isOpen={!!payProduct}
        onClose={() => setPayProduct(null)}
        currentNick={user?.nick || "오이박사"}
        currentUid={user?.email || ""}
        onDone={() => {
          setPayProduct(null);
          queryClient.invalidateQueries({ queryKey: ["products"] });
          toast("🎉 거래가 완료됐어요!");
        }}
      />
    </div>
  );
}
