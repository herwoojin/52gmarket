"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeImageStatus, getPendingImages } from "@/lib/imageStatus";

/** 아무리 늦어도 이 시간이 지나면 오버레이를 걷는다 (사용자를 붙잡아두지 않기 위해) */
const MAX_WAIT_MS = 12000;
/** 목록이 그려진 직후 잠깐은 기다렸다가 판단한다 (깜빡임 방지) */
const SETTLE_MS = 400;

/**
 * 매물 사진이 아직 다 뜨지 않았을 때 보여주는 로딩.
 *
 * 사진은 프록시를 거치며 간헐적으로 실패하는데, ProductImage 가 조용히
 * 재시도한다. 그동안 반쯤 빈 목록을 보여주면 "안 뜬 건가?" 하고 의심하게 되므로
 * 다 뜰 때까지(또는 최대 대기시간까지) 진행 상태를 덮어서 보여준다.
 */
export default function ImageLoadingOverlay({ active }: { active: boolean }) {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setPending(getPendingImages());
    update();
    return subscribeImageStatus(update);
  }, []);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    // 처음 몇 백 ms 는 판단을 미뤄 깜빡임을 막는다
    const settle = setTimeout(() => setVisible(getPendingImages() > 0), SETTLE_MS);
    const cap = setTimeout(() => setVisible(false), MAX_WAIT_MS);
    return () => {
      clearTimeout(settle);
      clearTimeout(cap);
    };
  }, [active]);

  useEffect(() => {
    if (pending === 0) setVisible(false);
    else if (active) setVisible(true);
  }, [pending, active]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-skin-0/85 backdrop-blur-sm">
      <span className="oiji-bounce select-none text-5xl">🥒</span>
      <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
        <Loader2 size={16} className="animate-spin text-cuke" />
        사진을 불러오는 중이에요
      </div>
      <p className="text-[12px] text-muted">
        남은 사진 {pending}장 — 잠시만 기다려주세요
      </p>

      <style jsx>{`
        @keyframes oiji-bounce-y {
          0%, 100% { transform: translateY(0); }
          45% { transform: translateY(-12px); }
        }
        .oiji-bounce {
          animation: oiji-bounce-y 1s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .oiji-bounce { animation: none; }
        }
      `}</style>
    </div>
  );
}
