# Firebase 전환 설정 가이드

구글 시트/앱스크립트의 느린 응답(요청당 10~40초)을 해결하기 위해
**실시간 데이터는 Firestore**, **인증과 기록은 기존 앱스크립트**로 역할을 나눴습니다.

## 역할 분담

| 기능 | 담당 | 이유 |
|---|---|---|
| 이메일 OTP 로그인 | 앱스크립트 (기존 유지) | Gmail 발송이 필요 |
| Firebase 접근 토큰 발급 | 앱스크립트 | OTP 통과자만 데이터 접근 허용 |
| 매물 목록·등록·수정 | **Firestore** | 실시간 반영 |
| 채팅 | **Firestore** | 실시간 반영 |
| 읽음 상태 | **Firestore** | 실시간 반영 |
| 사진 저장 | **Firebase Storage** | Drive 프록시(base64) 제거 |
| 거래완료·포인트 기록 | 앱스크립트 + 시트 | 이력 보관 |

---

## 설정 순서 (반드시 이 순서대로)

### 1) 서비스 계정 키 발급 — 가장 중요

Firebase 콘솔 → **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성**
→ JSON 파일이 다운로드됩니다.

그 JSON 안에서 두 값을 꺼냅니다:
- `client_email`
- `private_key`

### 2) 앱스크립트 스크립트 속성에 등록

Apps Script 편집기 → ⚙️ 프로젝트 설정 → 스크립트 속성

| 속성 | 값 |
|---|---|
| `FB_CLIENT_EMAIL` | JSON 의 `client_email` 값 |
| `FB_PRIVATE_KEY` | JSON 의 `private_key` 값 **통째로** (`-----BEGIN PRIVATE KEY-----` 부터 끝까지, 줄바꿈 포함) |

> 이 두 값이 없으면 커스텀 토큰이 발급되지 않아 Firestore 접근이 전부 막힙니다.

### 3) Code.gs 재배포

Code.gs 전체를 붙여넣고 **배포 관리 → 새 버전**으로 배포합니다.
(커스텀 토큰 발급 함수가 이번에 추가됐습니다)

### 4) Netlify 환경변수 등록

Site configuration → Environment variables 에 추가:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC-bzULH_xpfqjrEYOaVZWI25Spbgt3PeI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=g-market-94b03.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=g-market-94b03
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=g-market-94b03.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1078863807156
NEXT_PUBLIC_FIREBASE_APP_ID=1:1078863807156:web:15df1c98f6729f71c6cde1
```

등록 후 **Clear cache and deploy site** 로 재배포해야 반영됩니다.
(`NEXT_PUBLIC_*` 는 빌드 시점에 코드에 박히기 때문입니다)

### 5) 보안 규칙 적용 — 빠뜨리면 데이터가 공개됩니다

Firebase 콘솔에서 각각 붙여넣고 **게시**:

- **Firestore Database → 규칙** ← 저장소의 `firestore.rules` 내용
- **Storage → 규칙** ← 저장소의 `storage.rules` 내용

기본 규칙(테스트 모드)은 30일 후 전체 차단되거나, 반대로 전체 공개일 수 있으니
반드시 위 파일 내용으로 교체하세요.

### 6) Firestore 색인 생성

매물 목록은 `status != '삭제'` 조건을 사용합니다.
첫 실행 시 콘솔에 색인 생성 링크가 뜨면 클릭해서 만들어 주세요.

### 7) 기존 데이터 이관

배포 후 `https://52gs.netlify.app/migrate` 접속 → **이관 시작**

- 관리자 계정만 접근할 수 있습니다
- 같은 매물은 덮어쓰므로 여러 번 눌러도 중복되지 않습니다
- 시트 데이터는 지워지지 않고 그대로 남습니다

---

## 확인 방법

1. 로그인 → 브라우저 콘솔에 Firebase 오류가 없는지
2. 홈 화면 매물이 **즉시** 뜨는지 (기존 10~40초 → 1초 미만)
3. 다른 기기/계정에서 매물을 올리면 **새로고침 없이** 목록에 나타나는지
4. 채팅 메시지가 **즉시** 상대방 화면에 표시되는지

## 문제가 생기면

Firebase 환경변수를 비우면 코드가 자동으로 기존 앱스크립트 경로로 되돌아갑니다.
모든 Firebase 연동에 폴백이 들어 있어, 설정을 지우는 것만으로 이전 상태로 복귀합니다.
