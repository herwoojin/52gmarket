# 05. GUIDE — 오이(52)지마켓 개발 가이드

> Antigravity IDE + Claude Code, 개발서버(`next dev`)에서 확인하며 개발.

---

## 0. 사전 준비
- Node.js 18+ / pnpm(또는 npm)
- Firebase 프로젝트(Auth·Storage·Firestore)
- 구글 시트 1개 + Apps Script 배포(첨부 `Code.gs`, `Sidebar.html`)
- 토스페이먼츠 테스트 키(결제 단계에서)

---

## 1. 프로젝트 생성
```bash
pnpm create next-app@latest oiji-market --ts --tailwind --app --eslint
cd oiji-market
pnpm add firebase @tanstack/react-query @tosspayments/payment-sdk
pnpm dlx shadcn@latest init        # 다크 베이스로 설정
pnpm dlx shadcn@latest add button card input textarea select dialog sheet badge avatar tabs sonner
pnpm add -D next-pwa               # 또는 수동 SW
```

## 2. 환경변수 `.env.local`
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=oiji-market.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=oiji-market
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=oiji-market.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/____/exec
NEXT_PUBLIC_OIJI_API_TOKEN=긴_비밀_토큰
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
```
> 같은 토큰을 Apps Script **스크립트 속성 `API_TOKEN`** 에도 넣습니다.

## 3. Firebase 콘솔 설정
1. Authentication → 로그인 방법 → **Google 사용 설정**, 승인된 도메인에 개발/배포 도메인 추가.
2. Storage → 시작, 규칙은 `04_ERD §5`.
3. Firestore → 데이터베이스 생성(프로덕션 모드), 규칙은 `04_ERD §5`.
4. 프로젝트 설정 → 웹 앱 추가 → `firebaseConfig` 복사 → `.env.local`.

## 4. 구글시트 + Apps Script
1. 새 시트, 탭 이름 `매물`(비워둬도 헤더 자동 생성).
2. 확장 프로그램 → Apps Script → `Code.gs` 붙여넣기, HTML 파일 `Sidebar` 추가.
3. 스크립트 속성: `API_TOKEN`, `FB_BUCKET`, (시트내 사진용)`FB_CLIENT_EMAIL`·`FB_PRIVATE_KEY`.
4. 배포 → 웹 앱(실행=나, 액세스=모든 사용자) → `/exec` URL → `.env.local`.
5. 시트 메뉴 `🥒 오이지마켓` 으로 등록/편집/사진/거래완료 처리 확인.

## 5. 핵심 모듈 골격

### `lib/firebase.ts`
```ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};
const app = getApps()[0] ?? initializeApp(cfg);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
```

### `lib/webp.ts`
```ts
export async function toWebp(file: File, max = 1280, q = 0.8): Promise<Blob> {
  const img = await createImageBitmap(file);
  let { width: w, height: h } = img;
  if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w*r); h = Math.round(h*r); }
  const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
  cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) =>
    cv.toBlob(b => (b ? res(b) : rej(new Error("WEBP 미지원"))), "image/webp", q));
}
```

### `lib/storage.ts`
```ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "./firebase";
export async function uploadPhoto(blob: Blob) {
  const uid = auth.currentUser!.uid;
  const r = ref(storage, `listings/${uid}/${Date.now()}.webp`);
  await uploadBytes(r, blob, { contentType: "image/webp" });
  return getDownloadURL(r);
}
```

`lib/sheets.ts`(API) 는 `03_TRD §4` 참조.

## 6. Tailwind 테마 토큰
`tailwind.config.ts`:
```ts
theme: { extend: { colors: {
  skin: { 0:"#0a120d",1:"#0e1813",2:"#14241b",line:"#22382b" },
  cuke: { DEFAULT:"#52c06e", bright:"#73d98a" },
  flesh:"#cfe8a6", seed:"#f2ecd2", ink:"#e9f2e8", muted:"#8ba596",
  warn:"#f2b84b", pay:"#3182f6",
}, borderRadius:{ xl2:"18px" } } }
```
`globals.css` 에 다크 배경 고정(`html{background:#0a120d;color:#e9f2e8}`), Pretendard 웹폰트.

## 7. PWA
- `public/manifest.json`(name/short_name/standalone/theme `#0a120d`/오이 아이콘).
- `next-pwa` 설정 또는 `public/sw.js` 등록. 앱 셸 캐시, 매물 API 네트워크 우선.
- iOS 설치 안내 배너 컴포넌트.

## 8. 실행 & 확인
```bash
pnpm dev          # http://localhost:3000
```
체크: 구글 로그인 → 사진 올리면 WEBP 변환·업로드 → 시트에 행 생성 → 목록 노출 → 찜/대화/결제.

## 9. 배포
- Vercel/Netlify에 환경변수 등록 후 배포.
- Firebase 승인된 도메인에 배포 도메인 추가.
- 배포 도메인을 PWA로 설치 테스트(모바일·태블릿).

## 10. 트러블슈팅
| 증상 | 원인/해결 |
|---|---|
| POST CORS 에러 | `Content-Type: text/plain` 으로 보내기(프리플라이트 회피) |
| 로그인 팝업 차단/도메인 오류 | Firebase 승인된 도메인에 현재 도메인 추가 |
| 업로드 권한 거부 | Storage 규칙 `request.auth.uid==uid`, 로그인 여부 확인 |
| 시트 사진 업로드 실패 | 서비스 계정 키/`FB_BUCKET` 속성 확인 |
| WEBP 미지원 브라우저 | JPEG 0.8 폴백 |

## 11. 코딩 컨벤션
- 사용자 노출 문구 **한국어**. 컴포넌트 PascalCase, 훅 `useXxx`.
- 매물 쓰기는 `lib/sheets.ts` 통해서만. 직접 fetch 금지.
- 본인 데이터만 수정(서버/규칙 + UI 모두 가드).
- 커밋: `feat/fix/chore: 한글 요약`.
