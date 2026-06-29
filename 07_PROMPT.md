# 07. PROMPT — 오이(52)지마켓 (Claude Code용)

> Antigravity IDE의 Claude Code 세션 시작 시 **PROJECT CONTEXT**를 먼저 붙이고,
> 이후 `06_TASK` 순서대로 **빌드 프롬프트**를 하나씩 보냅니다.

---

## A. PROJECT CONTEXT (세션 시작 시 1회 붙여넣기)

```
너는 "오이(52)지마켓"의 시니어 프론트엔드 엔지니어다. 사내에서 버려지는 전산소모품·
사무용품을 직원끼리 나눔/재판매하는 모바일 우선 PWA를 만든다. 마스코트는 채소 '오이'.

[스택]
- Next.js 14 App Router + TypeScript(strict) + Tailwind + shadcn/ui
- 인증: Firebase Auth(Google) / 이미지: Firebase Storage(WEBP)
- 매물 DB: Google Sheets + Apps Script Web App(fetch)
- 실시간(채팅/찜/키워드/알림): Cloud Firestore
- 결제: 토스페이먼츠(우선), 상태관리: TanStack Query, 토스트: sonner

[비타협 규칙]
1. 모든 사용자 노출 문구는 한국어.
2. 다크 UI·모바일 우선. 하단 탭(홈/항아리/올리기/알림/내정보).
3. 실명·이메일은 타인에게 절대 노출 금지. 닉네임+근무지만 노출.
4. 매물 사진은 업로드 전 클라이언트에서 WEBP(최대 1280px, q0.8) 변환, 용량 절감률 표시.
5. 매물 쓰기는 lib/sheets.ts 통해서만. 본인 데이터만 수정(uid 가드).
6. POST는 Content-Type text/plain 으로(프리플라이트 회피).
7. 찜은 'AI 향(오이지 담그기)' 메타포 — 항아리에 담는 UI.
8. 새 라이브러리 도입 전 물어보고, 한 번에 한 기능만 구현.

[디자인 토큰]
skin-0 #0a120d / skin-1 #0e1813 / skin-2 #14241b / line #22382b
cuke #52c06e / cuke-bright #73d98a / flesh #cfe8a6 / seed #f2ecd2
ink #e9f2e8 / muted #8ba596 / warn #f2b84b / pay #3182f6 / radius 18px

[데이터 모델]
매물 시트 컬럼: id, createdAt, status(판매중/거래완료/삭제), deal(나눔/판매),
category, title, price, desc, loc, nick, uid, photoURL, jjim, chats
(상세는 첨부 04_ERD 참조)

작업은 06_TASK의 T번호 순서로 의뢰한다. 각 작업마다:
구현 → 변경 파일 요약 → 개발서버 확인 방법(클릭 경로) 을 함께 알려줘.
불명확하면 가정하지 말고 질문해라.
```

---

## B. 빌드 프롬프트 (TASK 순서대로 하나씩)

> 형식: 한 메시지 = 한 작업. 아래를 복붙해 쓰되 필요 시 다듬어 사용.

### T0.2 테마
```
T0.2를 구현해줘. tailwind.config.ts에 위 디자인 토큰을 colors로 확장하고,
globals.css에 다크 배경 고정(html: bg #0a120d, color #e9f2e8)과 Pretendard 웹폰트를 적용해.
샘플 버튼 하나로 cuke/skin 색이 보이게 확인 페이지를 잠깐 보여줘.
```

### T1.1 셸 + 하단 탭
```
T1.1: 5개 라우트(홈 /, 올리기 /upload, 항아리 /jar, 알림 /noti, 내정보 /me)와
하단 고정 탭바(가운데 '＋ 올리기'는 떠있는 FAB)를 만들어. 활성 탭 강조,
safe-area 패딩, 모바일/태블릿 반응형. 아이콘은 lucide-react.
```

### T1.2 구글 로그인
```
T1.2: Firebase 구글 로그인/로그아웃과 AuthProvider(컨텍스트)를 구현해.
내정보 페이지에 로그인 버튼/현재 이메일 표시. 비로그인 시 올리기에서 로그인 유도.
```

### T1.4 + T1.5 매물 API + 목록
```
T1.4와 T1.5: lib/sheets.ts(list/create/update/remove, POST는 text/plain, token 포함)를 만들고,
홈에서 TanStack Query로 목록을 불러와 카드 그리드(모바일2/태블릿3, 최신순)로 보여줘.
카테고리·거래방식(전체/나눔/판매) 칩 필터 포함. 카드: 썸네일·제목·가격(또는 '무료나눔')·
근무지·@닉네임·찜수·대화수·거래완료 배지.
```

### T1.6 + T1.7 WEBP 업로드 + 등록
```
T1.6/T1.7: lib/webp.ts(canvas 변환)와 lib/storage.ts(Storage 업로드)를 만들고,
올리기 폼(제목/카테고리/거래방식/단가/근무지/설명/사진)을 구현해.
사진 선택 시 WEBP 변환 후 원본→변환 용량과 절감률을 보여주고, 등록 시 Storage 업로드 →
photoURL 포함해 createProduct 호출 → 성공 토스트 → 홈으로 이동하고 목록을 리패치해.
```

### T1.8 상세
```
T1.8: 매물 상세를 shadcn Sheet(하단 모달)로. 큰 이미지·설명·메타(픽업 근무지/@닉네임/카테고리)와
하단 액션(찜 토글 / 대화하기 / 판매면 결제). 실명/이메일은 절대 표시하지 말 것.
```

### T1.9 항아리(찜)
```
T1.9: Firestore users/{uid}/wishlist로 찜 토글을 구현하고, 항아리 탭에 찜한 매물을 모아줘.
찜 시 시트의 jjim을 +1/-1로 갱신(updateProduct). 빈 상태는 '항아리가 비었어요' 안내.
```

### T1.10 PWA
```
T1.10: manifest.json(이름 '오이(52)지마켓', standalone, theme #0a120d, 오이 아이콘)과
서비스워커(앱 셸 캐시, 매물 API는 네트워크 우선)를 추가하고 iOS 설치 안내 배너를 만들어.
```

### T2.1 채팅
```
T2.1: 매물별 대화창을 Firestore chats/{productId}/messages 실시간 구독으로 구현해.
빠른답장 칩('아직 가능할까요?','미리 찜할게요','픽업 시간은?'), 전송 시 즉시 반영,
대화 시작 시 chats 도 시트의 chats 카운트를 +1.
```

### T2.3 + T2.4 알림
```
T2.3/T2.4: 키워드 등록/삭제(Firestore)와, 매물 등록 직후 본인 키워드와 제목/설명 매칭 시
인앱 알림 생성 + 알림 탭 배지 갱신을 구현해. (FCM은 Phase 3)
```

### T2.5 결제
```
T2.5: 토스페이먼츠 SDK로 판매 매물 결제를 구현해. 결제 요약(상품가+안전수수료),
성공 시 updateProduct(id,{status:'거래완료'}) 및 채팅으로 픽업 안내 메시지.
스트라이프/페이팔은 payments.ts에서 동일 인터페이스로 어댑터만 분리.
```

---

## C. 점검 프롬프트 (수시)
```
지금까지 구현을 06_TASK 기준으로 점검해줘. P0 항목 중 누락/미달 수용기준을 표로 정리하고,
프라이버시 규칙(실명 미노출)·WEBP 변환·본인데이터 가드가 지켜졌는지 코드 근거와 함께 확인해줘.
```

---

## D. 사용 순서 요약
1. 새 Claude Code 세션 → **A) PROJECT CONTEXT** 붙여넣기 + (가능하면 `03_TRD`,`04_ERD`,`05_GUIDE` 첨부)
2. **B) 빌드 프롬프트**를 `06_TASK` 순서대로 하나씩
3. 개발서버에서 확인 → 커밋 → 다음 작업
4. 단계 끝마다 **C) 점검 프롬프트**
