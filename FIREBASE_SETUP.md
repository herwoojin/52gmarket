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
| 사진 저장 | 앱스크립트 → Google Drive (기존 유지) | Firebase Storage 는 유료 플랜 필요 |
| 거래완료·포인트 기록 | 앱스크립트 + 시트 | 이력 보관 |

---

## 설정 순서 (반드시 이 순서대로)

### 1) 서비스 계정 키 없이 서명 위임하기

조직 정책(`doridorimammam-org`)이 서비스 계정 **키 생성을 차단**하고 있습니다.
그래서 키 파일을 내려받는 대신, **Google 의 IAM Credentials API 에 서명을 요청**하는
방식을 씁니다. 키는 Google 이 계속 보관하므로 정책에 걸리지 않습니다.

서비스 계정 이메일은 콘솔에 표시된 값을 그대로 씁니다:

```
firebase-adminsdk-fbsvc@g-market-94b03.iam.gserviceaccount.com
```

### 2) 실행 계정에 '서비스 계정 토큰 생성자' 역할 부여

앱스크립트는 **배포한 본인 계정**으로 실행되므로, 그 계정이 위 서비스 계정을
대신해 서명할 수 있어야 합니다.

[Google Cloud 콘솔 → IAM 및 관리자 → 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=g-market-94b03)

1. `firebase-adminsdk-fbsvc@...` 클릭
2. 상단 **권한** 탭 → **액세스 권한 부여**
3. 새 주 구성원: **앱스크립트를 배포하는 본인 Google 계정**
4. 역할: **서비스 계정 토큰 생성자** (`roles/iam.serviceAccountTokenCreator`)
5. 저장

> 이 역할이 없으면 서명 요청이 403 으로 거부됩니다.

또한 프로젝트에서 **IAM Service Account Credentials API** 가 사용 설정되어 있어야 합니다.
([사용 설정 링크](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=g-market-94b03))

### 3) 앱스크립트 설정

**(a) 스크립트 속성** — ⚙️ 프로젝트 설정 → 스크립트 속성

| 속성 | 값 |
|---|---|
| `FB_SERVICE_ACCOUNT` | `firebase-adminsdk-fbsvc@g-market-94b03.iam.gserviceaccount.com` |

> 이전 안내의 `FB_CLIENT_EMAIL` / `FB_PRIVATE_KEY` 는 이제 필요 없습니다.

**(b) 매니페스트에 스코프 추가** — ⚙️ 프로젝트 설정 →
"편집기에서 `appsscript.json` 매니페스트 파일 표시" 체크
→ 편집기에 나타난 `appsscript.json` 을 저장소의 `appsscript.json` 내용으로 교체

`https://www.googleapis.com/auth/cloud-platform` 스코프가 있어야 서명 요청이 가능합니다.
저장 후 **아무 함수나 한 번 실행해서 권한 재승인** 팝업을 통과시켜 주세요.

**(c) 동작 확인** — 편집기에서 함수 목록 중 `testFirebaseToken` 선택 후 실행
→ 실행 로그에 `✅ 성공` 이 뜨면 완료입니다.
실패하면 로그에 원인(403 권한 / 스코프 미승인)이 함께 표시됩니다.

**(d) Code.gs 재배포** — 배포 관리 → 새 버전

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

> Storage 규칙은 필요 없습니다. Firebase Storage 는 신규 프로젝트에서
> Blaze(종량제) 플랜을 요구하므로 사용하지 않고, 사진은 기존처럼
> 앱스크립트를 통해 Google Drive 에 저장합니다.
> 나중에 요금제를 올려 쓰고 싶으면 Netlify 환경변수에
> `NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true` 를 추가하면 됩니다.

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
