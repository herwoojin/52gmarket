"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmDeposit } from "@/lib/payment";
import { Loader2, BadgeCheck, AlertCircle } from "lucide-react";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "done" | "error">("processing");

  useEffect(() => {
    const productId = params.get("productId");
    if (!productId) { setStatus("error"); return; }

    confirmDeposit(productId)
      .then(() => {
        setStatus("done");
        setTimeout(() => router.replace("/"), 3000);
      })
      .catch(() => setStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      {status === "processing" && (
        <>
          <Loader2 size={40} className="animate-spin text-cuke" />
          <p className="text-[16px] font-bold">결제 처리 중...</p>
        </>
      )}
      {status === "done" && (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cuke/15">
            <BadgeCheck size={48} className="text-cuke" />
          </div>
          <p className="text-[22px] font-extrabold">결제 완료!</p>
          <p className="text-[14px] text-muted">거래가 성사됐어요. 3초 후 홈으로 이동합니다.</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-2 rounded-2xl bg-cuke px-8 py-3 text-[15px] font-bold text-skin-0"
          >
            지금 홈으로
          </button>
        </>
      )}
      {status === "error" && (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/15">
            <AlertCircle size={48} className="text-red-400" />
          </div>
          <p className="text-[18px] font-extrabold">오류가 발생했어요</p>
          <p className="text-[13px] text-muted">결제는 처리됐을 수 있어요. 채팅으로 판매자에게 알려주세요.</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-2 rounded-2xl border border-skin-line px-8 py-3 text-[14px] font-bold text-muted"
          >
            홈으로
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cuke" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
