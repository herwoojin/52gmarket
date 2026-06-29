# 03. TRD — 오이(52)지마켓

> 기술 설계. 프론트는 선호 스택(Next.js+TS+Tailwind+shadcn/ui),
> 백엔드는 Firebase(인증·저장) + 구글시트/Apps Script(매물 DB) + Firestore(실시간).

---

## 1. 아키텍처 개요

```
┌─────────────────────────── Client (PWA) ───────────────────────────┐
│ Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui         │
│  - Firebase Auth (Google 로그인)                                     │
│  - 사진: Canvas WEBP 변환 → Firebase Storage 업로드                  │
│  - 매물: fetch → Apps Script Web App (구글시트)                      │
│  - 채팅/찜/키워드/알림토큰: Firestore (실시간)                       │
│  - 결제: 토스페이먼츠 SDK (옵션 Stripe/PayPal)                       │
└─────────────────────────────────────────────────────────────────────┘
        │ GET/POST(JSON)              │ Auth/Upload          │ realtime
        ▼                             ▼                      ▼
┌───────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Apps Script Web   │   │ Firebase Auth /    │   │ Firestore          │
│ App (doGet/doPost)│   │ Storage            │   │ chats, wishlists,  │
│        │          │   │ (WEBP 이미지)      │   │ keywords, fcm      │
│        ▼          │   └────────────────────┘   └────────────────────┘
│  Google Sheet     │
│  '매물' (단일출처) │  ← 관리자가 직접 편집/삭제 + 사이드바 등록
└───────────────────┘
```

**설계 원칙**: *매물* 데이터는 운영자가 직접 편집 가능해야 하므로 구글시트가 단일 출처. *채팅·찜·알림*은 실시간/개인 데이터라 Firestore. *이미지*는 Storage. *인증*은 Firebase Auth.

---

## 2. 기술 스택
| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14 (App Router) | 개발서버 `next dev` |
| 언어 | TypeScript | strict |
| 스타일 | Tailwind CSS + shadcn/ui | 다크 UI, 모바일 우선 |
| 상태/서버데이터 | TanStack Query | 매물 목록 캐시/리패치 |
| 인증 | Firebase Auth (Google) | `firebase/auth` |
| 이미지 저장 | Firebase Storage | WEBP |
| 매물 DB | Google Sheets + Apps Script | REST(fetch) |
| 실시간 DB | Cloud Firestore | 채팅·찜·키워드·알림 |
| 결제 | 토스페이먼츠(우선) | Stripe/PayPal 옵션 |
| 푸시 | FCM (Phase 3) | 웹 푸시 |
| PWA | next-pwa 또는 수동 SW | manifest + service worker |
| 배포 | Vercel 또는 Netlify | 환경변수 주입 |

---

## 3. 프론트엔드 구조 (제안)
```
app/
  layout.tsx            // 다크 테마, 폰트, AuthProvider, QueryProvider
  page.tsx              // 홈(목록)
  upload/page.tsx       // 올리기
  jar/page.tsx          // 오이지 항아리(찜)
  noti/page.tsx         // 알림
  me/page.tsx           // 내정보
components/
  ProductCard.tsx  ProductDetailSheet.tsx  ChatSheet.tsx
  PaymentSheet.tsx  UploadForm.tsx  BottomTab.tsx  AuthButton.tsx
lib/
  firebase.ts           // Firebase 초기화
  auth.ts               // 구글 로그인 훅
  sheets.ts             // Apps Script API 클라이언트(list/create/update/remove)
  storage.ts            // WEBP 변환 + Storage 업로드
  firestore.ts          // 채팅/찜/키워드 구독·쓰기
  payments.ts           // 토스/스트라이프 호출
  webp.ts               // canvas 변환 유틸
types/index.ts          // Product, Message, Wishlist, Keyword 등
public/
  manifest.json  sw.js  icons/
```

---

## 4. 데이터 API (Apps Script Web App)

배포: 웹 앱, 실행=소유자, 액세스=모든 사용자. 베이스 URL = `APPS_SCRIPT_URL`.

### 4.1 GET — 매물 목록
```
GET {APPS_SCRIPT_URL}
→ { ok:true, items: Product[] }   // status!=='삭제', 최신순
```

### 4.2 POST — 등록/수정/삭제 (CORS preflight 회피: Content-Type text/plain)
```jsonc
// 등록
{ "token": "...", "action": "create",
  "item": { "title","category","deal","price","desc","loc","nick","uid","photoURL" } }
→ { ok:true, id }

// 수정
{ "token":"...", "action":"update", "id":"p..", "patch": { ...changed } }
→ { ok:true }

// 삭제(소프트: status=삭제)
{ "token":"...", "action":"delete", "id":"p.." }
→ { ok:true }
```

`lib/sheets.ts` 예시:
```ts
const post = (payload: object) =>
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token: API_TOKEN }),
  }).then(r => r.json());

export const listProducts = () => fetch(APPS_SCRIPT_URL).then(r => r.json());
export const createProduct = (item: NewProduct) => post({ action: "create", item });
export const updateProduct = (id: string, patch: Partial<Product>) => post({ action: "update", id, patch });
export const removeProduct = (id: string) => post({ action: "delete", id });
```

---

## 5. 이미지 파이프라인 (WEBP)
1. `<input type=file accept="image/*" capture>` 로 선택/촬영.
2. `Image` 로드 → `canvas` 최대 1280px 리사이즈 → `canvas.toBlob(blob, 'image/webp', 0.8)`.
3. 원본/변환 용량·절감률 UI 표시.
4. `storage.ref('listings/{uid}/{ts}.webp').put(blob)` → `getDownloadURL()`.
5. URL을 `createProduct({ photoURL })` 로 시트에 기록.

> 관리자가 시트 사이드바에서 직접 올릴 때는 Apps Script 서비스 계정으로 Storage REST 업로드(첨부된 `Code.gs` 참조).

---

## 6. 실시간 데이터 (Firestore)
- `chats/{productId}/messages/{msgId}` — `onSnapshot` 실시간 구독.
- `users/{uid}/wishlist/{productId}` — 찜 토글(개인).
- `users/{uid}/keywords/{kwId}` — 키워드 구독.
- `users/{uid}/notifications/{notiId}` — 인앱 알림 기록.
- (대안) 전부 시트로 유지 가능하나 실시간성↓·폴링 필요 → 채팅은 Firestore 권장.

알림 매칭 흐름(Phase 1 단순형): 매물 등록 직후 클라이언트가 본인 키워드와 새 매물 제목/설명을 비교 → 매칭 시 인앱 알림 생성. (Phase 3) Apps Script 트리거 + FCM 으로 서버측 매칭/푸시.

---

## 7. 결제
- 토스페이먼츠: `@tosspayments/payment-sdk` → `requestPayment` → 성공 redirect/confirm → `updateProduct(id,{status:'거래완료'})`.
- 결제 확정 검증은 서버 필요(간이: Apps Script `confirm` 엔드포인트 또는 Cloud Function). 초기엔 클라이언트 확정 + 수동확인, 정식화 시 서버 confirm.
- Stripe Checkout / PayPal Buttons는 동일 패턴의 옵션 어댑터로 추상화(`payments.ts`).

---

## 8. PWA
- `manifest.json`: name "오이(52)지마켓", display standalone, theme `#0a120d`, 아이콘(오이 SVG/PNG).
- 서비스워커: 앱 셸·정적 자원 캐시(stale-while-revalidate), 매물 API는 네트워크 우선.
- iOS 설치 안내(공유→홈화면 추가) 배너.

---

## 9. 보안
- Firebase Storage 규칙: `listings/**` 읽기 공개, 쓰기 `request.auth != null`.
- Firestore 규칙: 본인 `users/{uid}/**` 만 read/write; `chats`는 참여자만.
- Apps Script: `API_TOKEN` 검증. **(강화)** `body.idToken`을 받아 Google tokeninfo 또는 Firebase Admin으로 검증 후 `uid` 신뢰.
- 서비스 계정 키는 Apps Script 속성에만, 프론트 노출 금지.

## 10. 환경변수
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APPS_SCRIPT_URL=
NEXT_PUBLIC_OIJI_API_TOKEN=        # 쓰기 토큰(노출 전제, ID토큰 검증으로 보완)
NEXT_PUBLIC_TOSS_CLIENT_KEY=
```

## 11. 디자인 토큰 (Tailwind 확장)
```
skin-0 #0a120d / skin-1 #0e1813 / skin-2 #14241b / line #22382b
cuke #52c06e / cuke-bright #73d98a / flesh #cfe8a6 / seed #f2ecd2
ink #e9f2e8 / muted #8ba596 / warn #f2b84b / pay #3182f6
radius 18px · font Pretendard
```

## 12. 에러 처리/관측
- API 실패 시 토스트 + 재시도(Query retry).
- 업로드 실패(브라우저 WEBP 미지원) 폴백: JPEG 0.8.
- 콘솔 외 간단 로깅(선택): Firestore `logs` 또는 Sheets.
