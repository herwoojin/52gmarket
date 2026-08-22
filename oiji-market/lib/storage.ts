import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, isFirebaseStorageEnabled } from "./firebase";
import { fetchAppsScript } from "./appsScript";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Firebase 없을 때 → Apps Script 경유 Google Drive 업로드 */
async function uploadToDrive(blob: Blob): Promise<string> {
  const dataUrl = await blobToBase64(blob);
  const base64 = dataUrl.split(",")[1];

  // 앱스크립트는 간헐적으로 실패한다(실측 40%). 사진을 여러 장 올리면
  // 한 장만 실패해도 등록 전체가 실패하므로 재시도 래퍼를 쓴다.
  const res = await fetchAppsScript(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "uploadPhoto",
      base64,
      filename: `photo_${Date.now()}.webp`,
      mimeType: blob.type || "image/webp",
    }),
  });
  const data = await res.json();
  if (!data.ok || !data.url) throw new Error(data.error || "사진 업로드 실패");
  return data.url as string;
}

/** WEBP blob을 업로드하고 다운로드 URL 반환 */
export async function uploadPhoto(blob: Blob, uid: string): Promise<string> {
  // Firebase Storage 는 신규 프로젝트에서 유료(Blaze) 플랜을 요구하므로
  // 기본적으로 사용하지 않는다. 나중에 요금제를 올리면 환경변수로 켤 수 있다.
  if (isFirebaseStorageEnabled && storage) {
    const storageRef = ref(storage, `listings/${uid}/${Date.now()}.webp`);
    await uploadBytes(storageRef, blob, { contentType: "image/webp" });
    return getDownloadURL(storageRef);
  }

  // Firebase 없으면 Google Drive (Apps Script 경유)
  if (APPS_SCRIPT_URL) {
    return uploadToDrive(blob);
  }

  // 완전 데모 모드 (Apps Script도 없음)
  return URL.createObjectURL(blob);
}
