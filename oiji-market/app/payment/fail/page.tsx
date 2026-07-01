"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function PaymentFailPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/15">
        <AlertCircle size={48} className="text-red-400" />
      </div>
      <p className="text-[20px] font-extrabold">결제가 취소됐어요</p>
      <p className="text-[13px] text-muted">결제를 다시 시도하거나 다른 방법을 선택해보세요.</p>
      <button
        onClick={() => router.back()}
        className="rounded-2xl bg-cuke px-8 py-3 text-[15px] font-bold text-skin-0"
      >
        돌아가기
      </button>
    </div>
  );
}
