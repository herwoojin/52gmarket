# TRD — 오이(52)지마켓

> **기술 요구사항 정의서 (Technical Requirements Document)**
> 최종 갱신: 2026-09-02

---

## 1. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────┐
│  브라우저 / PWA (Next.js 정적 빌드)                        │
│  React 19 · Tailwind 4 · TanStack Query · Firebase SDK    │
└───────┬─────────────────┬──────────────────┬─────────────┘
        │                 │                  │
   ①실시간 데이터      ②인증·사진·메일      ③푸시
        │                 │                  │
        ▼                 ▼                  ▼
┌───────────────┐  ┌────────────────┐  ┌──────────┐
│  Firestore    │  │ Google Apps    │  │ OneSignal│
│  (g-market-   │  │ Script (웹앱)   │  │ Web Push │
│   94b03)      │  │                │  └──────────┘
│               │  │  · OTP 메일     │       ▲
│ products      │  │  · 커스텀토큰   │       │
│ rooms         │  │  · 사진→Drive  │───────┘
│  └messages    │  │  · 시트 이력    │  (REST 키를 서버가 보관)
│ points        │  └───────┬────────┘
│ keywords      │          │
│ reads         │          ▼
└───────────────┘  ┌────────────────┐
        ▲          │ Google Sheets  │
        │          │ 매물/채팅/포인트 │ ← 이력 보관용
        │          └────────────────┘
        │                 ▲
┌───────┴─────────────────┴──────┐
│  Netlify (호스팅 + Functions)    │
│  · 정적 파일 CDN                 │
│  · /api/items, /api/img 프록시   │
└─────────────────────────────────┘
```

### 역할 분담 — 왜 이렇게 나눴나

| 기능 | 담당 | 이유 |
|---|---|---|
| 매물·채팅·읽음·포인트 | **Firestore** | 실시간 반영이 필요. Apps Script 는 요청당 10~40초 |
| 이메일 OTP 발송 | Apps Script | Gmail 발송 권한이 필요 |
| Firebase 접근 토큰 발급 | Apps Script | OTP 통과자에게만 DB 접근을 허용하기 위한 관문 |
| 사진 저장 | Apps Script → Drive | Firebase Storage 는 Blaze(유료) 플랜 필요 |
| 푸시 발송 | Apps Script → OneSignal | REST 키를 클라이언트에 둘 수 없음 |
| 이력 보관 | Google Sheets | 비개발자가 스프레드시트로 확인·수정 가능 |

> **핵심 판단:** "전부 Firebase 로" 가 아니라 **실시간이 필요한 것만** 옮겼다.
> 메일 발송·Drive 업로드는 Apps Script 가 이미 잘 하고 있고, 옮길 실익이 없다.

---

## 2. 기술 스택

### 프론트엔드
| 기술 | 버전 | 용도 |
|---|---|---|
| Next.js | 16.2.9 | App Router, **`output: "export"` 정적 빌드** |
| React | 19.2.4 | UI |
| TypeScript | 5.x | 타입 |
| Tailwind CSS | 4.x | 스타일 |
| TanStack Query | 5.x | 서버 상태 (Apps Script 폴백 경로) |
| Firebase JS SDK | 12.x | Firestore 실시간 구독 · Auth |
| lucide-react | 1.x | 아이콘 |
| sonner | 2.x | 토스트 |

> **`output: "export"` 인 이유:** Netlify 정적 호스팅으로 CDN 캐시를 최대한 활용하기
> 위함. SSR 이 필요 없고(사내 서비스라 SEO 불필요), 정적이면 배포·롤백이 단순하다.
> 대신 **서버 컴포넌트에서 DB 를 읽을 수 없어** 모든 데이터 접근이 클라이언트에서 일어난다.

### 백엔드
| 기술 | 용도 |
|---|---|
| Google Apps Script | 웹앱 (`doGet`/`doPost`) — OTP, 토큰, 사진, 시트 |
| Cloud Firestore | 실시간 DB |
| Firebase Auth | 커스텀 토큰 인증 |
| Netlify Functions v2 | CDN 캐시 프록시 |
| OneSignal | 웹 푸시 |

---

## 3. 인증 흐름

### 3.1 전체 시퀀스

```
사용자                프론트           Apps Script         Firebase
  │                    │                   │                  │
  │─ 이메일 입력 ──────>│                   │                  │
  │                    │─ sendOtp ────────>│                  │
  │                    │                   │─ 도메인 검사      │
  │                    │                   │─ 6자리 생성·저장  │
  │<───────── 메일 발송 ────────────────────│                  │
  │                    │                   │                  │
  │─ 6자리 입력 ───────>│                   │                  │
  │                    │─ verifyOtp ──────>│                  │
  │                    │                   │─ 코드 대조        │
  │                    │                   │─ signJwt 요청 ──>│
  │                    │                   │<── 커스텀 토큰 ───│
  │                    │<── {ok, token} ───│                  │
  │                    │─ signInWithCustomToken ─────────────>│
  │                    │<────────────── ID 토큰 ──────────────│
  │<─── 홈 화면 ────────│                   │                  │
```

### 3.2 커스텀 토큰을 서비스 계정 키 없이 만드는 법 (중요)

조직 정책이 **서비스 계정 키 파일 생성을 차단**한다. 그래서 개인키를 내려받아
직접 JWT 에 서명하는 일반적인 방법을 쓸 수 없다.

대신 **IAM Credentials API 에 서명을 위임**한다. 키는 Google 이 계속 보관하므로
정책에 걸리지 않는다.

```javascript
// Code.gs
function createFirebaseCustomToken_(uid) {
  var sa = getProp_('FB_SERVICE_ACCOUNT');   // firebase-adminsdk-...@....iam.gserviceaccount.com
  var now = Math.floor(Date.now() / 1000);
  var claims = {
    iss: sa, sub: sa,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid: uid,
  };
  // 개인키 없이 Google 에 서명을 요청한다
  var res = UrlFetchApp.fetch(
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' + sa + ':signJwt',
    {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ payload: JSON.stringify(claims) }),
    }
  );
  return JSON.parse(res.getContentText()).signedJwt;
}
```

**필요 설정 (하나라도 빠지면 403):**
1. `appsscript.json` 에 `https://www.googleapis.com/auth/cloud-platform` 스코프
2. IAM Service Account Credentials API 사용 설정
3. 배포 계정에 **서비스 계정 토큰 생성자**(`roles/iam.serviceAccountTokenCreator`) 역할
4. 스크립트 속성 `FB_SERVICE_ACCOUNT`
5. 스코프 추가 후 **권한 재승인** (아무 함수나 1회 실행)

> 편집기에서 `testFirebaseToken()` 을 실행해 `✅ 성공` 이 뜨는지 먼저 확인할 것.

### 3.3 uid 규칙

**uid = 이메일 주소 그대로.** 별도 매핑 테이블이 없어 보안 규칙이 단순해진다
(`request.auth.uid == 'name@gsretail.com'`).

### 3.4 토큰 만료 처리

커스텀 토큰은 발급 후 **1시간** 동안만 유효하다. 저장해둔 토큰을 나중에 재사용하면
`signInWithCustomToken` 이 400 을 반환한다. 그래서 **발급 시각을 함께 저장**하고
50분이 지났으면 쓰지 않는다.

---

## 4. Firestore 설계

### 4.1 컬렉션

```
products/{productId}
rooms/{roomId}
rooms/{roomId}/messages/{msgId}
points/{productId}          ← 문서 id = 매물 id (멱등성)
keywords/{uid}
reads/{uid}__{roomId}       ← 레거시. 읽음은 rooms.reads 맵으로 이동
```

상세 필드는 [04_ERD.md](04_ERD.md) 참조.

### 4.2 roomId 규칙

```
roomId = `${productId}__${[uidA, uidB].sort().join("__")}`
```

uid 를 **정렬**해서 붙이므로 누가 먼저 말을 걸든 두 사람이 같은 방을 공유한다.

### 4.3 읽음 상태를 방 문서 안에 둔 이유

읽음을 별도 컬렉션(`reads/{uid}__{roomId}`)에 두면, 보안 규칙상 **본인 기록만**
읽을 수 있어 "상대가 읽었는지"를 알 수 없다. 방 문서는 양쪽 참여자가 모두 읽을 수
있으므로, `rooms/{roomId}.reads = { uid: timestamp }` 맵에 넣었다.

### 4.4 보안 규칙 핵심

```javascript
// 매물 — 주인만 수정. 단 찜/채팅수/상태는 남도 바꿀 수 있어야 한다
match /products/{id} {
  allow read: if signedIn();
  allow update: if signedIn() && (
    resource.data.uid == request.auth.uid
    || request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['jjim','chats','status'])
  );
  allow delete: if false;          // 실제 삭제 금지 (status='삭제' 로만)
}

// 대화방 — 참여자만
match /rooms/{roomId} {
  // 아직 없는 방(resource == null)은 조회 허용 — 새 대화를 열 때 필요하고,
  // 없는 문서에는 유출될 정보가 없다
  allow read: if signedIn()
    && (resource == null || request.auth.uid in resource.data.participants);

  match /messages/{msgId} {
    function roomRef() { return /databases/$(database)/documents/rooms/$(roomId); }
    // 방이 없으면 읽을 메시지도 없다. 막으면 새 대화가 로딩에서 멈춘다
    allow read: if signedIn() && (!exists(roomRef()) || isParticipant());
    // 발신자 사칭 차단
    allow create: if isParticipant() && request.resource.data.senderUid == request.auth.uid;
    allow update, delete: if false;   // 보낸 메시지는 수정·삭제 불가
  }
}

// 포인트 — '본인 확인'이 아니라 '매물 주인 확인'
match /points/{productId} {
  allow read: if signedIn();                    // 랭킹 집계용
  allow create: if signedIn()
    && exists(/databases/$(database)/documents/products/$(productId))
    && request.resource.data.uid
       == get(/databases/$(database)/documents/products/$(productId)).data.uid;
  allow update, delete: if false;               // 한 번 적립되면 불변
}

match /{document=**} { allow read, write: if false; }   // 그 외 전부 차단
```

> **주의:** 규칙은 파일을 고쳐도 **Firebase 콘솔에서 게시(Publish)** 해야 적용된다.
> 배포를 빠뜨리면 데이터가 열려 있거나(테스트 모드) 전부 막힌다.

---

## 5. 성능 설계

### 5.1 측정 결과 (실측)

| 구간 | 개선 전 | 개선 후 | 방법 |
|---|---|---|---|
| 매물 목록 | 35.3초 | **0.33초** | Netlify CDN 프록시 |
| 사진 1장 | 2.2초 | **0.5초** | Drive 썸네일 직접 호출 |
| 채팅 전송 | 3~4 왕복 | 즉시 | await 제거 (지연 보상) |

### 5.2 Netlify Functions CDN 프록시

Apps Script 는 **요청당 10~40초**의 플랫폼 오버헤드가 있고 약 40% 확률로 404 를
반환한다. 함수 내부 코드를 최적화해도 소용이 없어서, 앞에 CDN 캐시를 뒀다.

```javascript
// netlify/functions/items.mjs
export const config = { path: "/api/items" };

export default async (req) => {
  const upstream = await fetchWithRetry(APPS_SCRIPT_URL + "?action=list");
  return new Response(upstream, {
    headers: {
      "Netlify-CDN-Cache-Control": "public, max-age=30, stale-while-revalidate=300",
    },
  });
};
```

`stale-while-revalidate` 덕분에 캐시가 만료돼도 **일단 옛 데이터를 즉시 주고**
뒤에서 갱신한다. 사용자는 기다리지 않는다.

### 5.3 Apps Script 재시도 래퍼

```typescript
// lib/appsScript.ts — 0.6s → 1.5s → 3s 백오프
export async function fetchAppsScript(url, init) { /* 3회 재시도 */ }
```

**모든** Apps Script 호출(로그인·CRUD·사진 업로드)이 이 래퍼를 거쳐야 한다.
사진 업로드가 이걸 안 쓰고 생 `fetch` 였던 것이 모바일 업로드 실패의 원인이었다.

### 5.4 채팅 지연 보상 (Latency Compensation)

Firestore 는 쓰기를 **로컬에 먼저 반영**하고 `onSnapshot` 을 즉시 발화시킨다.
따라서 `await` 하지 않아야 메시지가 지연 없이 화면에 뜬다.

```typescript
// 잘못된 방식 — 왕복 3~4회를 기다린다
await getDoc(roomRef); await setDoc(...); await addDoc(...);

// 올바른 방식 — 기다리지 않는다. SDK 가 순서를 보장한다
setDoc(roomRef, {...}, { merge: true }).catch(...);
addDoc(messagesRef, {...}).catch(...);
```

### 5.5 캐시 스냅샷 함정

Firestore 는 서버 응답 전에 **로컬 캐시 기준 스냅샷**을 먼저 준다. 그게 비어 있으면
화면에 떠 있던 목록을 지워버린다 ("이전 자료가 잠깐 떴다가 사라짐"의 원인).

```typescript
if (snap.metadata.fromCache && snap.empty) return;   // 무시
```

### 5.6 이미지 재시도

Drive 썸네일은 처음 요청 시 생성 지연으로 실패할 수 있다.
`ProductImage` 컴포넌트가 **0.7s → 1.8s → 3.5s → 6s** 로 4회 재시도하며,
캐시를 우회하려 `&r=N` 을 붙인다. 사용자에게는 로딩 오버레이만 보인다.

---

## 6. 푸시 알림

### 6.1 왜 OneSignal 인가
FCM 을 직접 쓰려면 서비스워커·토큰 관리·서버 발송을 전부 구현해야 한다.
OneSignal 은 무료 티어로 웹 푸시를 제공하고 `external_id` 로 사용자를 지정할 수 있어,
**uid(이메일)를 그대로 타겟팅 키로** 쓸 수 있다.

### 6.2 권한 팝업 억제
`autoPrompt: false` 만으로는 부족했다. **SDK 자체를 지연 로드**한다 —
사용자가 알림 버튼을 누를 때 처음으로 스크립트를 주입한다.

### 6.3 REST 키 보관 (보안)

> ⚠️ **저장소가 GitHub 공개이므로 OneSignal REST 키를 코드에 넣으면 안 된다.**
> Apps Script **스크립트 속성**에 보관하고 `getProp_('ONESIGNAL_REST_API_KEY')` 로 읽는다.
> 키가 커밋된 적이 있다면 **반드시 로테이션**할 것.

### 6.4 중복 알림 방지 (5중 가드)

`ChatWatcher` 컴포넌트가 다음 경우 알림을 띄우지 않는다:
1. 내가 보낸 메시지
2. 이미 읽은 대화 (`lastAt <= reads[myUid]`)
3. 같은 메시지 재발화
4. 첫 스냅샷 (구독 시작 시 기존 데이터가 전부 "새 메시지"로 보이는 문제)
5. 이미 `/chats` 화면에 있을 때

---

## 7. 배포

### 7.1 프론트엔드 (자동)
`main` 브랜치 push → Netlify 자동 빌드 → `oiji-market/out` 배포

### 7.2 Apps Script (수동)
`Code.gs` 수정 → 편집기에 붙여넣기 → **배포 관리 → 새 버전**
현재: **버전 31**

> 배포 설정에서 **액세스 권한 = "모든 사용자"** 여야 한다. 아니면 403 + CORS 헤더
> 없는 HTML 이 반환되어 로그인이 통째로 실패한다. (실제로 겪은 장애)

### 7.3 Firestore 규칙 (수동)
`firestore.rules` 수정 → 콘솔에 붙여넣기 → **게시**

### 7.4 환경변수 (Netlify)

```bash
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=g-market-94b03.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=g-market-94b03
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_ONESIGNAL_APP_ID=...
```

> `NEXT_PUBLIC_*` 는 **빌드 시점에 코드에 박힌다.** 값을 바꾸면
> **Clear cache and deploy site** 로 재배포해야 반영된다.

### 7.5 캐시 정책 (netlify.toml)

| 대상 | 정책 | 이유 |
|---|---|---|
| HTML | `no-store` | 구버전 HTML 이 새 JS 청크를 못 찾는 문제 방지 |
| `/_next/static/*` | `max-age=31536000, immutable` | 파일명에 해시가 있어 안전 |
| `sw.js` | `no-store` | 서비스워커는 항상 최신이어야 함 |
| `manifest.json` | `application/manifest+json` | PWABuilder 가 MIME 을 검사함 |

---

## 8. 서비스워커 주의사항

```javascript
// 반드시 유효한 Response 를 반환해야 한다.
// caches.match() 는 miss 시 undefined 를 주는데,
// 그걸 respondWith 에 넘기면 "Failed to convert value to 'Response'" 로 앱이 죽는다
event.respondWith(
  caches.match(req).then((hit) => hit || fetch(req)).catch(() => new Response("", { status: 504 }))
);
```

- **외부 origin(Drive, Firestore, OneSignal)은 가로채지 않고 통과**시킨다
- HTML 은 network-first (최신 배포 반영)
- 캐시 이름에 버전을 붙인다 (`oiji-market-v3`)

---

## 9. 보안 체크리스트

- [ ] OneSignal REST 키가 코드에 없는가 (스크립트 속성 사용)
- [ ] `.env.local` 이 `.gitignore` 에 있는가
- [ ] **`signing.keystore` / `signing-key-info.txt` 를 커밋하지 않았는가**
      (Android 서명 키. 유출되면 앱을 사칭당한다. 별도 안전한 곳에 백업할 것)
- [ ] Firestore 규칙이 콘솔에 게시되었는가
- [ ] 이메일 도메인 검사가 **서버에서도** 이루어지는가
- [ ] 커스텀 토큰 만료(1시간)를 확인하는가

---

## 10. 파일 구조

```
52gmarket/
├── Code.gs                  # Apps Script 백엔드 전체
├── appsscript.json          # 매니페스트 (cloud-platform 스코프)
├── firestore.rules          # 보안 규칙
├── netlify.toml             # 빌드·캐시·헤더
├── 02_PRD.md 03_TRD.md 04_ERD.md 07_PROMPT.md
│
└── oiji-market/
    ├── app/
    │   ├── page.tsx         # 홈 (매물 목록)
    │   ├── login/           # OTP 로그인
    │   ├── upload/          # 매물 등록
    │   ├── chats/           # 채팅 목록
    │   ├── jar/             # 찜
    │   ├── ranking/         # 랭킹
    │   ├── noti/            # 알림·키워드
    │   ├── me/              # 내정보
    │   └── migrate/         # 관리자 (이관·진단·소급)
    │
    ├── components/
    │   ├── AppShell.tsx           # 헤더(원형 로그아웃) + 레이아웃
    │   ├── BottomTab.tsx          # 하단 탭 (채팅 배지)
    │   ├── ChatSheet.tsx          # 대화 화면
    │   ├── ChatWatcher.tsx        # 전역 새 채팅 감지 (5중 중복 가드)
    │   ├── ProductImage.tsx       # 이미지 자동 재시도
    │   ├── ImageLoadingOverlay.tsx
    │   ├── OneSignalInit.tsx      # 지연 로드
    │   └── ...
    │
    ├── lib/
    │   ├── firebase.ts            # 초기화 · ensureFirebaseAuth
    │   ├── productsFirestore.ts   # 매물 실시간 구독
    │   ├── chatFirestore.ts       # 채팅 · 읽음 · 숨김
    │   ├── pointsFirestore.ts     # 포인트 적립 · 집계 · 소급
    │   ├── appsScript.ts          # 재시도 래퍼 (필수 경유)
    │   ├── driveImage.ts          # Drive 썸네일 URL
    │   ├── webp.ts                # WebP 변환
    │   └── ...
    │
    ├── netlify/functions/
    │   ├── items.mjs              # /api/items CDN 프록시
    │   └── img.mjs                # /api/img
    │
    └── public/
        ├── sw.js  manifest.json
        └── .well-known/assetlinks.json
```
