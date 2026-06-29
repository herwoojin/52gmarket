import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, isDemoMode } from "./firebase";

/** WEBP blob을 Firebase Storage에 업로드하고 다운로드 URL 반환 */
export async function uploadPhoto(blob: Blob, uid: string): Promise<string> {
  if (isDemoMode || !storage) {
    // 데모 모드: object URL 반환
    return URL.createObjectURL(blob);
  }

  const storageRef = ref(storage, `listings/${uid}/${Date.now()}.webp`);
  await uploadBytes(storageRef, blob, { contentType: "image/webp" });
  return getDownloadURL(storageRef);
}
