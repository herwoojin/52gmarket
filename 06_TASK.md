# 06. TASK — 오이(52)지마켓 작업 분해

> 체크리스트. 마일스톤 단위로 Claude Code에 하나씩 의뢰. 각 작업엔 수용 기준 포함.

---

## Phase 0 — 셋업
- [ ] T0.1 Next.js+TS+Tailwind+shadcn/ui 프로젝트 생성 — *AC*: `pnpm dev` 정상, 다크 배경.
- [ ] T0.2 Tailwind 오이 토큰 + Pretendard + 글로벌 다크 — *AC*: `bg-skin-0`,`text-cuke` 적용됨.
- [ ] T0.3 `lib/firebase.ts` 초기화 + `.env.local` — *AC*: 콘솔 에러 없이 import.
- [ ] T0.4 구글시트+Apps Script 배포, `APPS_SCRIPT_URL` 연결 — *AC*: GET 호출 시 `{ok:true,items:[]}`.
- [ ] T0.5 QueryProvider/Toaster(sonner) 레이아웃 주입 — *AC*: 토스트 표시.

## Phase 1 — MVP (P0)
- [ ] T1.1 BottomTab + 5개 라우트 셸(홈/올리기/항아리/알림/내정보) — *AC*: 탭 전환, 활성 표시.
- [ ] T1.2 Firebase 구글 로그인/로그아웃 + AuthProvider — *AC*: 로그인 상태 전역 접근, 내정보에 이메일.
- [ ] T1.3 프로필(닉네임/근무지) Firestore 저장·로드 — *AC*: 저장 후 새로고침 유지, 실명 미노출.
- [ ] T1.4 `lib/sheets.ts` (list/create/update/remove) — *AC*: 4개 함수 동작.
- [ ] T1.5 매물 목록 + 필터(카테고리/거래) — *AC*: 카드 그리드(2/3열), 최신순, 필터 반영.
- [ ] T1.6 `lib/webp.ts`+`storage.ts` WEBP 변환·업로드 — *AC*: 원본/변환 용량·절감률 표시, Storage 저장.
- [ ] T1.7 올리기 폼 → 업로드 → `createProduct` — *AC*: 시트에 행 생성, 목록 최상단 노출.
- [ ] T1.8 매물 상세 시트(이미지/설명/메타/액션) — *AC*: 닉네임·근무지만, 실명 없음.
- [ ] T1.9 찜=오이지 항아리(Firestore wishlist) + 항아리 탭 — *AC*: 토글, 항아리 모음, 찜수 반영.
- [ ] T1.10 PWA manifest+SW, iOS 설치 안내 — *AC*: 모바일 "홈 화면에 추가" 설치.
- [ ] T1.11 반응형 QA(모바일/태블릿) — *AC*: 360~1024px 깨짐 없음, 포커스 보임.

## Phase 2 — 거래·소통 (P1)
- [ ] T2.1 대화창(Firestore `chats/{id}/messages` 실시간) — *AC*: 양방향 실시간, 빠른답장 칩.
- [ ] T2.2 대화 수/찜 수 시트 캐시 갱신 — *AC*: 카드 카운트 변동.
- [ ] T2.3 키워드 등록/삭제(Firestore) — *AC*: 칩 추가/삭제 유지.
- [ ] T2.4 등록 시 키워드 매칭 → 인앱 알림 + 탭 배지 — *AC*: 매칭 매물 등록 시 알림 +1.
- [ ] T2.5 결제 시트(토스페이먼츠) → 거래완료 — *AC*: 테스트 결제 성공 시 `status=거래완료`.
- [ ] T2.6 거래완료 배지/필터 — *AC*: 완료 매물 구분 표시.

## Phase 3 — 운영·확장 (P2)
- [ ] T3.1 FCM 웹푸시(백그라운드 알림) — *AC*: 권한 허용 시 푸시 수신.
- [ ] T3.2 Apps Script 서버측 키워드 매칭 트리거 — *AC*: 클라 미접속 시에도 알림 적재.
- [ ] T3.3 지역사무소별 통계/절감액 추정 대시보드 — *AC*: 집계 수치 표시.
- [ ] T3.4 결제 서버 확정(Function/Apps Script confirm) — *AC*: 위변조 방지 확정.
- [ ] T3.5 ID 토큰 검증으로 쓰기 보안 강화 — *AC*: 토큰만으로는 쓰기 불가.

---

## 진행 규칙
1. 한 번에 **한 작업**만 의뢰, 개발서버에서 확인 후 다음.
2. 작업 의뢰 시 `03_TRD`·`05_GUIDE` 해당 섹션 참조 명시.
3. 완료 시 체크 + 커밋(`feat: T1.7 올리기 업로드`).
4. P0 전체 통과 = 사내 베타 배포 기준.
