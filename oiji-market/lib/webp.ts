/** Canvas WEBP 변환 유틸 */

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(url);
      createImageBitmap(img).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없어요. JPG/PNG/WEBP 파일을 사용해주세요."));
    };
    img.src = url;
  });
}

export async function toWebp(file: File, maxSize = 1280, quality = 0.8): Promise<Blob> {
  // createImageBitmap 직접 시도 → HEIC 등 실패 시 <img> 경유
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file);
  } catch {
    img = await loadImageBitmap(file);
  }

  let { width: w, height: h } = img;

  if (w > maxSize || h > maxSize) {
    const ratio = Math.min(maxSize / w, maxSize / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  img.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) { resolve(blob); return; }
        // WEBP 미지원 시 JPEG 폴백
        canvas.toBlob(
          (jpegBlob) => {
            if (jpegBlob) resolve(jpegBlob);
            else reject(new Error("이미지 변환에 실패했어요"));
          },
          "image/jpeg",
          quality
        );
      },
      "image/webp",
      quality
    );
  });
}

/** 용량 포맷 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 절감률 계산 */
export function savingsPercent(original: number, converted: number): number {
  if (original === 0) return 0;
  return Math.round(((original - converted) / original) * 100);
}
