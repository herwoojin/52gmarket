"use client";

import { useEffect, useRef, useState } from "react";
import { getImgSrc } from "@/lib/driveImage";
import { imageStarted, imageSettled } from "@/lib/imageStatus";

const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [700, 1800, 3500, 6000];

interface Props {
  /** 저장된 photoURL (여러 장이면 첫 장을 쓸 URL 하나만 넘긴다) */
  url: string | undefined;
  alt: string;
  className?: string;
  /** 사진이 없을 때 보여줄 자리 (오이 이모지 등) */
  fallback?: React.ReactNode;
}

/**
 * 매물 사진.
 *
 * 프록시가 간헐적으로 실패하므로, 실패하면 화면에 깨진 이미지를 남기지 않고
 * 조용히 다시 시도한다. 재시도할 때마다 쿼리를 붙여 캐시된 실패 응답을 피한다.
 * 로딩 상태는 전역 카운터에 보고해 목록 화면이 "아직 덜 떴다"를 알 수 있게 한다.
 */
export default function ProductImage({ url, alt, className, fallback }: Props) {
  const base = getImgSrc(url);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);
  const reported = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 사진이 바뀌면 처음부터 다시
  useEffect(() => {
    setAttempt(0);
    setDone(false);
  }, [base]);

  useEffect(() => {
    if (!base || done) return;
    if (!reported.current) {
      reported.current = true;
      imageStarted();
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [base, done]);

  const settle = (ok: boolean) => {
    if (reported.current) {
      reported.current = false;
      imageSettled(ok);
    }
    setDone(true);
  };

  if (!base) {
    return <>{fallback ?? null}</>;
  }

  const src = attempt === 0 ? base : `${base}&r=${attempt}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={() => settle(true)}
      onError={() => {
        if (attempt < MAX_RETRIES) {
          // 조용히 재시도 — 사용자에게는 로딩으로만 보인다
          timer.current = setTimeout(
            () => setAttempt((a) => a + 1),
            RETRY_DELAYS_MS[attempt] ?? 6000
          );
        } else {
          settle(false);
        }
      }}
    />
  );
}
