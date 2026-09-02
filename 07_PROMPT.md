# PROMPT — 오이(52)지마켓 재현 지시서

> **다른 IDE(Cursor / Windsurf / Antigravity / Copilot 등)에서 이 프로젝트를
> 처음부터 만들 때 AI 에게 그대로 붙여넣는 프롬프트 모음.**
> 최종 갱신: 2026-09-02

---

## 사용법

1. 먼저 **[0] 컨텍스트 프롬프트**를 붙여넣어 AI 에게 프로젝트 전체를 이해시킨다.
2. 그다음 **[1] → [9]** 를 순서대로 하나씩 진행한다. 한 번에 다 주지 말 것.
3. 각 단계가 끝나면 반드시 빌드가 통과하는지 확인하고 다음으로 넘어간다.

> ⚠️ **함께 제공할 파일:** `02_PRD.md`, `03_TRD.md`, `04_ERD.md` 를 저장소에 넣고
> AI 에게 "이 세 파일을 먼저 읽어라"고 지시하면 정확도가 크게 올라간다.

---

## [0] 컨텍스트 프롬프트 (가장 먼저)

```
당신은 "오이(52)지마켓"이라는 사내 중고거래 PWA를 만든다.
GS 계열사 임직원 전용이며, 사무용품·전산소모품·가구를 나눔하거나 판매한다.

## 기술 스택 (변경 금지)
- Next.js 16 App Router + `output: "export"` 정적 빌드
- React 19, TypeScript, Tailwind CSS 4
- Cloud Firestore — 매물/채팅/포인트 (실시간)
- Google Apps Script — 이메일 OTP, 사진 업로드(Drive), 푸시 발송 중계
- Netlify — 호스팅 + Functions(CDN 프록시)
- OneSignal — 웹 푸시

## 반드시 지킬 아키텍처 원칙

1. **실시간이 필요한 것만 Firestore 로.** 메일 발송·Drive 업로드는 Apps Script 가
   담당한다. Apps Script 는 요청당 10~40초 오버헤드가 있어 실시간 용도로 못 쓴다.

2. **uid = 이메일 주소 그대로.** 별도 매핑 테이블을 만들지 말 것. 보안 규칙이 단순해진다.

3. **Firebase Storage 를 쓰지 말 것.** Blaze(유료) 플랜이 필요하다.
   사진은 Apps Script 를 통해 Google Drive 에 저장한다.

4. **삭제는 실제 삭제가 아니다.** `status='삭제'` 로 표시만 한다.
   실제로 지우면 포인트 검증 근거와 대화 이력이 끊긴다.

5. **모든 Apps Script 호출은 재시도 래퍼를 거친다.** 약 40% 확률로 404를 반환한다.

## 코드 스타일
- 주석은 한국어. **"무엇을"이 아니라 "왜"를 적는다.**
  (나쁨: `// 방 문서를 저장한다`  좋음: `// 메시지보다 방을 먼저 써야 규칙이 참여자를 읽을 수 있다`)
- 사용자에게 보이는 문구는 한국어 존댓말, 친근한 톤 ("~해요")
- 파일당 200줄을 넘기지 말 것
- 과도한 추상화 금지. 지금 필요한 것만 만든다.
```

---

## [1] 프로젝트 초기화

```
Next.js 16 프로젝트를 만든다.

- 이름: oiji-market
- TypeScript, Tailwind CSS 4, App Router, src 디렉토리 사용 안 함
- 패키지 매니저: pnpm

next.config.ts 에 정적 빌드를 설정한다:
  output: "export", images: { unoptimized: true }

추가 설치: firebase, @tanstack/react-query, lucide-react, sonner

types/index.ts 에 다음을 정의한다:

- Product 인터페이스
  id, createdAt, status('판매중'|'거래완료'|'삭제'|'입금대기'),
  deal('나눔'|'판매'), category('전산소모품'|'사무용품'|'가구·비품'|'기타'),
  title, price, desc, loc, nick, uid, photoURL, jjim, chats

- NewProduct = Omit<Product, 'id'|'createdAt'|'status'|'jjim'|'chats'>

- ALLOWED_EMAIL_DOMAINS: Record<도메인, 회사명> — 11개 GS 계열사
  gs.co.kr=(주)GS, gsretail.com=GS리테일, gsenc.com=GS건설,
  gscaltex.com=GS칼텍스, gspower.co.kr=GS파워, gseps.com=GS EPS,
  gsenr.com=GS E&R, gsg.co.kr=GS글로벌, gsentec.com=GS엔텍,
  gssports.co.kr=GS스포츠, parnas.co.kr=파르나스호텔

- isAllowedEmail(email), getCompanyName(email)
  ⚠️ 도메인은 정규식으로 완전 일치 비교할 것.
     includes() 를 쓰면 gsretail.com.evil.com 으로 우회된다.

- LOCATIONS: 역삼타워, 강서타워, 강서N타워, 편)강동/수원/대전/부산/광주/원주/창원/청주/제주사무실, 기타

디자인 토큰(Tailwind):
  cuke(연두 #7CB342 계열) = 브랜드색, skin-0/1/2 = 배경 단계,
  ink = 본문, muted = 보조텍스트, skin-line = 테두리
  둥근 모서리는 rounded-oiji(16px) 사용. 다크모드 우선.
```

---

## [2] Apps Script 백엔드

```
Google Apps Script 웹앱(Code.gs)을 작성한다. 스프레드시트에 바인딩된다.

## doGet 액션
list, chat, chatReads, sellerChats, ranking, myPoints, pointsRanking,
bankInfo, img, ping

## doPost 액션
sendOtp, verifyOtp, create, update, delete, uploadPhoto, sendChat,
markChatRead, setKeywords, confirmDeal, confirmDeposit, pushChat

## 시트
"매물", "채팅", "포인트이력" — 없으면 자동 생성

## 이메일 OTP
- ALLOWED_EMAIL_DOMAINS 배열로 도메인 완전 일치 검사 (서버에서도 반드시 검사)
- 6자리 난수 생성, 유효기간 5분
- ⚠️ OTP는 시트가 아니라 **스크립트 속성**에 저장한다 (시트에 쓰면 그대로 노출된다)
- MailApp.sendEmail 로 발송

## Firebase 커스텀 토큰 (핵심)
조직 정책이 서비스 계정 키 생성을 차단하므로, 개인키로 직접 서명할 수 없다.
대신 IAM Credentials API 에 서명을 위임한다.

function createFirebaseCustomToken_(uid) {
  var sa = getProp_('FB_SERVICE_ACCOUNT');
  var now = Math.floor(Date.now()/1000);
  var claims = {
    iss: sa, sub: sa,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now+3600, uid: uid
  };
  var res = UrlFetchApp.fetch(
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+sa+':signJwt',
    { method:'post', contentType:'application/json',
      headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ payload: JSON.stringify(claims) }) }
  );
  return JSON.parse(res.getContentText()).signedJwt;
}

verifyOtp 성공 시 이 토큰을 응답에 함께 담는다.
편집기에서 단독 실행할 수 있는 testFirebaseToken() 진단 함수도 만든다.

## 사진 업로드
base64 → Drive 저장 → 공개 링크 반환.
photoURL 은 쉼표로 이어붙여 최대 3장까지.

## 푸시 (OneSignal)
⚠️ REST API 키를 코드에 절대 하드코딩하지 말 것 (저장소가 공개된다).
   getProp_('ONESIGNAL_REST_API_KEY') 로 스크립트 속성에서 읽는다.
include_aliases 의 external_id 로 uid(이메일)를 타겟팅한다.

## 응답
모든 응답은 JSON. CORS 는 배포 설정의 "액세스 권한 = 모든 사용자"로 처리된다.

appsscript.json 에 다음 스코프를 포함한다:
  spreadsheets, drive, script.send_mail, script.external_request,
  https://www.googleapis.com/auth/cloud-platform
webapp.access = "ANYONE_ANONYMOUS"
```

---

## [3] Firebase 연동

```
lib/firebase.ts 를 만든다.

- 환경변수(NEXT_PUBLIC_FIREBASE_*)로 초기화
- isFirebaseEnabled: 설정이 모두 있는지
- isFirebaseStorageEnabled: 기본 false (Blaze 필요). 절대 기본 true 로 두지 말 것
- signInToFirebase(customToken): signInWithCustomToken 실행 후
  토큰과 **발급 시각**을 localStorage 에 저장
- ensureFirebaseAuth(): 로그인 완료를 기다리는 Promise

⚠️ 커스텀 토큰은 발급 후 1시간만 유효하다.
   저장된 토큰이 50분을 넘었으면 사용하지 않는다.
   (재사용하면 signInWithCustomToken 이 400 을 반환한다)

firestore.rules 를 만든다:

- signedIn(), isSelf(uid) 헬퍼
- products: 로그인하면 읽기. 수정은 주인만, 단 ['jjim','chats','status'] 만
  바꾸는 경우는 남도 허용(diff().affectedKeys().hasOnly). delete 는 false
- rooms: participants 에 포함된 사람만.
  ⚠️ read 조건에 `resource == null` 을 반드시 넣을 것.
     없으면 새 대화를 열 때 구독이 거부돼 화면이 로딩에서 멈춘다
- rooms/{id}/messages: 방 존재 여부를 exists() 로 확인.
  방이 없으면 읽기 허용(읽을 게 없으므로), 쓰기는 참여자 + 발신자 사칭 차단.
  update/delete 는 false
- points/{productId}: 읽기는 로그인한 전원(랭킹).
  create 는 request.resource.data.uid 가 해당 매물의 uid 와 같을 때만.
  ⚠️ '본인 확인'이 아니라 '매물 주인 확인'이다. 거래 상대가 완료 처리해도
     포인트는 매물 주인에게 가야 한다. update/delete 는 false
- keywords/{uid}: isSelf
- match /{document=**}: 전부 차단
```

---

## [4] 로그인

```
app/login/page.tsx 를 만든다. 2단계(이메일 → 6자리).

1단계
- 배너 이미지
- 이메일 입력. 입력 중 계열사명 실시간 표시 ("✓ GS리테일 계정으로 확인됐어요")
- **로그인 가능한 11개사 목록을 항상 표시** (2열 그리드, 회사명 + @도메인)
- "인증번호 받기" 버튼 (유효한 도메인일 때만 활성)

2단계
- 6칸 입력. 숫자만. 입력 시 다음 칸 자동 포커스, Backspace 시 이전 칸
- 6자리 붙여넣기 → 6칸에 자동 분배 후 즉시 검증 (onPaste 에서 처리)
- 각 input 에 inputMode="numeric" autoComplete="one-time-code"
  → 모바일에서 메일의 인증번호가 키보드 위에 자동 제안된다
- 5분 카운트다운
- 마지막 칸 입력 완료 시 자동 검증

검증 성공 시:
  1) res.firebaseToken 으로 signInToFirebase() 먼저
  2) 그다음 signIn(email) 로 앱 로그인
  3) 홈으로 replace

⚠️ 모든 Apps Script 호출은 lib/appsScript.ts 의 fetchAppsScript() 재시도
   래퍼를 쓴다 (0.6s → 1.5s → 3s). 생 fetch 를 쓰면 40% 확률로 실패한다.
```

---

## [5] 매물

```
## lib/productsFirestore.ts
- subscribeProducts(onChange): where("status","!=","삭제") 실시간 구독
  ⚠️ ensureFirebaseAuth() 를 await 한 뒤에 구독해야 규칙에 막히지 않는다
  ⚠️ snap.metadata.fromCache && snap.empty 인 스냅샷은 무시한다.
     Firestore 는 서버 응답 전 로컬 캐시 스냅샷을 먼저 주는데, 그게 비어 있으면
     화면의 목록을 지워버린다 ("이전 자료가 잠깐 떴다 사라짐"의 원인)
- createProductFs / updateProductFs / fetchProductsOnce

## lib/driveImage.ts
- MAX_PHOTOS = 3
- parsePhotoUrls / joinPhotoUrls (쉼표 구분)
- getImgSrc(url): Drive 파일 id 를 뽑아
  `https://drive.google.com/thumbnail?id={id}&sz=w1000` 를 반환
  ⚠️ 네트워크 요청 없이 주소만 만든다. fetch→base64 변환을 하면 매우 느리다

## components/ProductImage.tsx
- 로딩 실패 시 자동 재시도 4회 (0.7s → 1.8s → 3.5s → 6s)
- 재시도마다 `&r=N` 을 붙여 캐시 우회
- 상태를 lib/imageStatus.ts 에 보고 → 전역 로딩 오버레이가 참조

## app/page.tsx (홈)
- 카테고리·거래방식·검색어 필터
- **기본 보기 = 작게 보기(테이블)**. 카드형 토글. localStorage 에 저장
- 첫 로딩 중에는 마스코트 애니메이션

## app/upload/page.tsx
- 사진 최대 3장. 선택 즉시 WebP 변환(canvas.toBlob, quality 0.85)
- 업로드 진행률 0~100% 표시
- ⚠️ 사진 업로드도 fetchAppsScript 재시도 래퍼를 쓴다.
     이걸 빠뜨린 것이 모바일 업로드 실패의 원인이었다
- 실패한 사진이 어느 것인지 알려준다

## 상세 시트
- 사진 3장 모두 열람 (스와이프)
- 판매자에게만 [거래완료] [수정] [삭제] 노출
- ⚠️ 구매자에게는 완료 버튼을 절대 주지 않는다.
     실수로 눌러 거래가 사라지는 사고가 있었다
```

---

## [6] 채팅

```
## lib/chat.ts
- buildRoomId(productId, uid1, uid2) = `${productId}__${[uid1,uid2].sort().join("__")}`
- SellerChatRoom: roomId, productId, productTitle, buyerUid, buyerNick,
  lastMsg, lastAt, msgCount, reads?, lastSenderUid?, hiddenAt?
- myLastReadOf(room, myUid) = Math.max(로컬캐시, room.reads?.[myUid] ?? 0)
- countUnreadRooms(rooms, reads, myUid)

## lib/chatFirestore.ts
- subscribeMessages(roomId, onChange)
  ⚠️ 오류 핸들러에서 반드시 onChange([]) 를 호출한다.
     아니면 권한 거부 시 화면이 영원히 로딩 상태로 멈춘다

- sendMessageFs(roomId, msg, meta): **async 가 아니다. await 하지 않는다**
  Firestore 는 쓰기를 로컬에 즉시 반영하고 onSnapshot 을 바로 발화시킨다.
  기다리면 왕복 3~4회만큼 느려진다.
  순서: ① setDoc(rooms/{id}, merge) → ② addDoc(messages)
  ⚠️ 방을 먼저 써야 한다. 메시지를 먼저 쓰면 규칙이 방의 participants 를
     읽지 못해 첫 메시지가 항상 권한 거부된다
  방을 쓸 때 reads:{보낸사람: serverTimestamp()} 도 함께 넣는다
  첫 메시지면 products/{id}.chats 를 increment(1)

- markRoomReadFs(uid, roomId): rooms/{id}.reads[uid] = serverTimestamp()
  ⚠️ 읽음을 별도 컬렉션에 두지 말 것. 규칙상 본인 것만 읽을 수 있어
     '상대가 읽었는지'를 알 수 없다. 방 문서는 양쪽이 다 읽을 수 있다

- hideRoomFs(uid, roomId): rooms/{id}.hiddenAt[uid] = serverTimestamp()
  ⚠️ 불리언이 아니라 타임스탬프다. 그래야 새 메시지가 오면
     lastAt > hiddenAt 이 되어 자동으로 다시 나타난다

- subscribeMyRooms(uid, onChange): where("participants","array-contains",uid)

## app/chats/page.tsx
- 실시간 목록. 안읽은 방은 빨간 점 + 강조
- 매물이 거래완료/삭제면 배지 표시 + 흐리게 + 목록 하단으로 정렬
- 각 행에 ✕ 삭제 버튼 → hideRoomFs 호출
  ⚠️ e.stopPropagation() 필수 (행 클릭과 겹친다)
  안내: "상대방 목록에는 그대로 남고, 새 메시지가 오면 다시 나타나요"
- 필터: hiddenAt[myUid] 가 있고 lastAt <= hiddenAt 이면 숨김
- 상단에 "거래완료 숨기기" 토글 (localStorage 저장)

## components/ChatWatcher.tsx
전역으로 새 메시지를 감지해 토스트를 띄운다.
⚠️ 다음 5가지 경우에는 알림을 띄우지 않는다 (중복 알림 방지):
   ① 내가 보낸 메시지
   ② 이미 읽은 대화 (lastAt <= reads[myUid])
   ③ 같은 메시지 재발화
   ④ 구독 시작 직후 첫 스냅샷 (기존 데이터가 전부 '새 메시지'로 보인다)
   ⑤ 이미 /chats 화면에 있을 때
```

---

## [7] 포인트 · 랭킹

```
## lib/pointsFirestore.ts

상수: NANUM_POINTS = 3, SALE_POINTS = 2

- recordPointsFs(product): setDoc(points/{productId}, {...})
  ⚠️ 문서 id 가 매물 id 다. 이것만으로 중복 적립이 원천 차단된다
     (두 번 실행해도 같은 문서를 덮어쓸 뿐 점수가 늘지 않는다)
  year, month 를 별도 필드로 저장한다.
  Firestore 는 타임스탬프에서 월을 뽑는 쿼리가 없기 때문이다.

- fetchAllPoints(): points 컬렉션을 기본으로 하되,
  아직 적립 기록이 없는 status='거래완료' 매물도 함께 계산한다.
  ⚠️ 이 안전장치가 중요하다. 소급 적립을 안 돌려도 랭킹이 맞고,
     적립이 누락돼도 집계가 비지 않는다.
     points 에 이미 있는 매물은 그쪽 기록을 우선한다.

- fetchMyPointsFs(uid), fetchPointsRankingFs(period: 'month'|'year'|'all')

- backfillPointsFs(onLog): 이미 완료된 매물에 포인트 소급 적립.
  완료 시각이 없으므로 createdAt(등록일)을 기준 연·월로 쓴다.
  이미 있으면 건너뛴다.

## app/ranking/page.tsx
- 이달 / 연간(2026) / 전체 3개 탭
- ⚠️ 세 탭 모두 같은 points 데이터로 집계한다.
     '전체'만 매물 개수로 세면 탭 간 숫자가 안 맞는다 (실제로 겪은 버그)
- 1~3위 메달

## app/me/page.tsx
- 이달 / 누적 / 2026년 포인트
- 내 매물 목록, 프로필 수정, 로그아웃
```

---

## [8] 알림 · PWA

```
## OneSignal
components/OneSignalInit.tsx
⚠️ SDK 를 자동으로 로드하지 말 것. autoPrompt:false 만으로는 부족하다.
   사용자가 알림 버튼을 누를 때 처음으로 스크립트를 주입한다(지연 로드).
   접속하자마자 권한 팝업이 뜨는 것을 사용자가 싫어한다.
로그인 후 external_id 를 uid(이메일)로 설정한다.

## public/sw.js
⚠️ 반드시 유효한 Response 를 반환할 것.
   caches.match() 는 miss 시 undefined 를 주는데, 그걸 respondWith 에 넘기면
   "Failed to convert value to 'Response'" 로 앱 전체가 죽는다.

- CACHE_NAME 에 버전을 붙인다 (oiji-market-v3)
- 외부 origin(Drive, Firestore, OneSignal)은 가로채지 말고 그대로 통과시킨다
- HTML 은 network-first (새 배포가 즉시 반영되도록)
- 정적 자산은 cache-first
- 모든 경로에서 catch 로 폴백 Response 를 반환

## public/manifest.json
name, short_name, start_url:"/", display:"standalone",
theme_color, background_color, icons(192/512, 실제 PNG여야 함)
⚠️ 아이콘 파일이 실제로 PNG인지 확인할 것. 확장자만 .png 이고 내용이 JPEG면
   PWABuilder 가 패키징을 거부한다. `file icon.png` 로 검증한다.

## netlify.toml
[build] base="oiji-market", command="pnpm build", publish="out"
[[redirects]] /* → /index.html (200)
헤더:
  "/" 와 "/*.html" → no-cache, no-store, must-revalidate
    (구버전 HTML이 새 JS 청크를 못 찾는 문제 방지)
  "/_next/static/*" → max-age=31536000, immutable (파일명에 해시가 있어 안전)
  "/manifest.json" → Content-Type: application/manifest+json
  "/sw.js" → Content-Type: application/javascript, no-store
  "/.well-known/*" → Content-Type: application/json, CORS *
```

---

## [9] 성능 최적화 (필수)

```
Apps Script 는 요청당 10~40초의 플랫폼 오버헤드가 있고 약 40% 확률로 404를
반환한다. 함수 내부 코드를 최적화해도 소용없다. 두 가지로 해결한다.

## 1) Netlify Functions CDN 프록시

netlify/functions/items.mjs:
  export const config = { path: "/api/items" };
  export default async (req) => {
    const body = await fetchWithRetry(APPS_SCRIPT_URL + "?action=list");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Netlify-CDN-Cache-Control":
          "public, max-age=30, stale-while-revalidate=300",
      },
    });
  };

stale-while-revalidate 덕분에 캐시가 만료돼도 옛 데이터를 즉시 주고 뒤에서
갱신한다. 사용자는 기다리지 않는다. (실측 35.3초 → 0.33초)

netlify/functions/img.mjs 도 같은 방식으로 만든다.

## 2) lib/appsScript.ts 재시도 래퍼

export async function fetchAppsScript(url, init) {
  // 0.6s → 1.5s → 3s 백오프로 3회 재시도
}

⚠️ 로그인, CRUD, 목록, **사진 업로드** 전부 이 래퍼를 거쳐야 한다.
```

---

## 배포 체크리스트

### Firebase 콘솔
- [ ] Firestore 생성 (프로덕션 모드)
- [ ] **규칙 게시** — 파일만 고치고 게시를 빠뜨리면 적용되지 않는다
- [ ] `products.status` 부등호 색인 (첫 실행 시 콘솔 링크)
- [ ] Authentication → 익명/커스텀 사용

### Google Cloud
- [ ] IAM Service Account Credentials API 사용 설정
- [ ] 배포 계정에 `roles/iam.serviceAccountTokenCreator` 부여

### Apps Script
- [ ] 스크립트 속성: `FB_SERVICE_ACCOUNT`, `ONESIGNAL_REST_API_KEY`
- [ ] `appsscript.json` 에 `cloud-platform` 스코프
- [ ] 스코프 추가 후 아무 함수나 1회 실행해 **권한 재승인**
- [ ] `testFirebaseToken()` 실행 → `✅ 성공` 확인
- [ ] 배포 → **액세스 권한 = "모든 사용자"**
      (아니면 403 + CORS 없는 HTML 이 와서 로그인이 통째로 실패한다)

### Netlify
- [ ] `NEXT_PUBLIC_*` 환경변수 등록
- [ ] **Clear cache and deploy site** (빌드 시점에 값이 박히므로)

### 보안
- [ ] OneSignal REST 키가 코드에 없는가
- [ ] `.env.local` 이 `.gitignore` 에 있는가
- [ ] **`signing.keystore` / `signing-key-info.txt` 를 커밋하지 않았는가**
      → Android 서명 키. 유출되면 앱을 사칭당하고, 잃어버리면 업데이트를
        영원히 배포할 수 없다. 별도 안전한 곳에 백업할 것

---

## 자주 겪는 함정 모음

| 증상 | 원인 | 해결 |
|---|---|---|
| 첫 채팅 메시지만 항상 실패 | 방보다 메시지를 먼저 씀 | 방 → 메시지 순서 |
| 새 대화 열면 무한 로딩 | 규칙이 없는 방 조회를 거부 | `resource == null` 허용 + 오류 시 `onChange([])` |
| 목록이 잠깐 떴다 사라짐 | 빈 캐시 스냅샷이 덮어씀 | `fromCache && empty` 무시 |
| 로그인 CORS 오류 | 배포 액세스가 "모든 사용자"가 아님 | 배포 설정 변경 |
| `signInWithCustomToken` 400 | 1시간 지난 토큰 재사용 | 발급 시각 확인(50분) |
| 랭킹 탭 간 숫자 불일치 | 탭마다 다른 소스로 집계 | 전부 points 로 통일 |
| 매물 삭제하니 포인트 사라짐 | 매물 기준 집계 | `points/{productId}` 영구 기록 |
| PWABuilder 패키징 거부 | 아이콘이 실제로 JPEG | `sips` 로 진짜 PNG 변환 |
| 앱이 하얗게 죽음 | SW 가 undefined 반환 | 항상 Response 반환 |
| 모바일 사진 업로드 실패 | 업로드가 재시도 래퍼 미사용 | `fetchAppsScript` 적용 |

---

## 개발 순서 권장

```
[1] 초기화 ─→ [2] Apps Script ─→ [3] Firebase ─→ [4] 로그인
                                                      │
        ┌─────────────────────────────────────────────┘
        ▼
[5] 매물 ─→ [6] 채팅 ─→ [7] 포인트 ─→ [8] PWA ─→ [9] 성능
```

각 단계마다 `pnpm build` 가 통과하는지 확인하고 넘어간다.
[9] 성능 최적화는 마지막이지만 **선택이 아니다.** 없으면 실사용이 불가능하다.
