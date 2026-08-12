"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "오이가 신선한 상품을 나르는 중...",
  "매물을 부지런히 찾고 있어요 🔍",
  "조금만 기다려주세요, 다 왔어요!",
  "오늘의 나눔·판매 매물 준비 중...",
];

/** 서버가 진행률을 알려주지 않으므로 경과 시간으로 추정한다.
 *  실측 응답시간이 5~70초로 편차가 커서, 95%에 점근하다 완료 시 사라진다. */
const TAU_MS = 14000;

export default function HomeLoadingMascot() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(t);
  }, []);

  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / TAU_MS))));
  const secs = (elapsed / 1000).toFixed(1);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      {/* 오이 마스코트 */}
      <div className="flex flex-col items-center">
        <div className="oiji-mascot select-none text-6xl">🥒</div>
        <div className="oiji-shadow mt-1 h-2 w-10 rounded-full bg-black/25 blur-[2px]" />
      </div>

      {/* 말풍선 메시지 */}
      <p key={msgIdx} className="oiji-msg-fade text-[13px] font-bold text-muted">
        {MESSAGES[msgIdx]}
      </p>

      {/* 진행률 — 서버가 진행률을 주지 않아 경과 시간 기반 추정치 */}
      <div className="w-full max-w-[260px]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[20px] font-extrabold tabular-nums text-cuke">{pct}%</span>
          <span className="text-[11px] tabular-nums text-muted">{secs}초</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-skin-2">
          <div
            className="h-full rounded-full bg-cuke transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-[10px] leading-tight text-muted">
          {elapsed > 20000
            ? "서버(구글 시트) 응답이 느린 상태예요. 조금만 더 기다려주세요"
            : "예상 진행률이에요 (서버가 정확한 진행률을 제공하지 않아요)"}
        </p>
      </div>

      {/* 상품 로딩 스켈레톤 카드 */}
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="oiji-skeleton overflow-hidden rounded-oiji border border-skin-line bg-skin-1"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="oiji-shimmer aspect-square bg-skin-2" />
            <div className="space-y-1.5 p-2.5">
              <div className="oiji-shimmer h-2.5 w-4/5 rounded bg-skin-2" />
              <div className="oiji-shimmer h-2.5 w-2/5 rounded bg-skin-2" />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes oiji-bounce {
          0%,
          100% {
            transform: translateY(0) scale(1, 1);
          }
          40% {
            transform: translateY(-14px) scale(0.96, 1.06);
          }
          55% {
            transform: translateY(0) scale(1.08, 0.9);
          }
          70% {
            transform: translateY(-4px) scale(0.99, 1.02);
          }
        }
        .oiji-mascot {
          animation: oiji-bounce 1.1s ease-in-out infinite;
        }
        @keyframes oiji-shadow-pulse {
          0%,
          100% {
            transform: scaleX(1);
            opacity: 0.25;
          }
          40% {
            transform: scaleX(0.55);
            opacity: 0.12;
          }
          70% {
            transform: scaleX(0.85);
            opacity: 0.2;
          }
        }
        .oiji-shadow {
          animation: oiji-shadow-pulse 1.1s ease-in-out infinite;
        }
        @keyframes oiji-msg-fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .oiji-msg-fade {
          animation: oiji-msg-fade-in 0.35s ease;
        }
        @keyframes oiji-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .oiji-skeleton {
          animation: oiji-fade-in 0.4s ease both;
        }
        @keyframes oiji-shimmer-sweep {
          0% {
            background-position: -150% 0;
          }
          100% {
            background-position: 150% 0;
          }
        }
        .oiji-shimmer {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.08) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: oiji-shimmer-sweep 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .oiji-mascot,
          .oiji-shadow,
          .oiji-msg-fade,
          .oiji-skeleton,
          .oiji-shimmer {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
