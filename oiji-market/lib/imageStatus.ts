/**
 * 화면에 떠야 할 사진 중 아직 못 불러온 개수를 세는 아주 작은 저장소.
 *
 * 사진은 앱스크립트 → Drive 프록시를 거치는데 간헐적으로 실패한다.
 * 화면 쪽에서 "몇 장이 아직 안 떴는지"를 알아야 로딩을 계속 보여주고
 * 조용히 재시도할 수 있어서 별도 카운터를 둔다.
 */

let pending = 0;
let failed = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeImageStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPendingImages(): number {
  return pending;
}

export function getFailedImages(): number {
  return failed;
}

export function imageStarted(): void {
  pending += 1;
  emit();
}

export function imageSettled(ok: boolean): void {
  pending = Math.max(0, pending - 1);
  if (!ok) failed += 1;
  emit();
}

/** 화면을 벗어나는 등으로 집계를 새로 시작할 때 */
export function resetImageStatus(): void {
  pending = 0;
  failed = 0;
  emit();
}
