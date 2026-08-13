"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { listProducts } from "@/lib/sheets";
import { fetchProductsOnce } from "@/lib/productsFirestore";
import { db, auth, isFirebaseEnabled } from "@/lib/firebase";
import { doc, setDoc, Timestamp, getDocs, collection } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { backfillPointsFs } from "@/lib/pointsFirestore";

const ADMIN_EMAILS = ["herhero78@gmail.com", "woojin.her@gsretail.com"];

/**
 * 구글 시트 → Firestore 1회성 이관 도구 (관리자 전용).
 * 같은 id 는 덮어쓰므로 여러 번 실행해도 중복이 생기지 않는다.
 */
export default function MigratePage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email);
  const add = (line: string) => setLog((prev) => [...prev, line]);

  const run = async () => {
    setRunning(true);
    setLog([]);
    try {
      if (!isFirebaseEnabled || !db) {
        add("❌ Firebase 설정이 없습니다. 환경변수를 먼저 등록하세요.");
        return;
      }

      add("① 구글 시트에서 매물을 읽는 중… (최대 40초 소요)");
      const sheetItems = await listProducts();
      add(`   시트 매물 ${sheetItems.length}건 확인`);
      if (sheetItems.length === 0) {
        add("옮길 매물이 없습니다.");
        return;
      }

      add("② Firestore 기존 데이터 확인 중…");
      const existing = await fetchProductsOnce();
      add(`   Firestore 기존 매물 ${existing.length}건`);

      add("③ 이관 시작…");
      let ok = 0;
      let fail = 0;
      for (const p of sheetItems) {
        try {
          await setDoc(
            doc(db, "products", p.id),
            {
              uid: p.uid,
              deal: p.deal,
              category: p.category,
              title: p.title,
              price: p.price,
              desc: p.desc,
              loc: p.loc,
              nick: p.nick,
              photoURL: p.photoURL,
              status: p.status,
              jjim: p.jjim ?? 0,
              chats: p.chats ?? 0,
              createdAt: p.createdAt
                ? Timestamp.fromDate(new Date(p.createdAt))
                : Timestamp.now(),
            },
            { merge: true }
          );
          ok++;
        } catch (err) {
          fail++;
          add(`   ⚠️ ${p.title} 실패: ${String(err)}`);
        }
      }
      add(`✅ 완료 — 성공 ${ok}건 / 실패 ${fail}건`);
      add("이제 홈 화면이 Firestore 를 실시간으로 읽습니다.");
    } catch (err) {
      add(`❌ 오류: ${String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setLog([]);
    try {
      add("이미 거래완료된 매물의 포인트를 소급 적립합니다…");
      await backfillPointsFs(add);
      add("내정보·랭킹 화면을 새로고침하면 반영된 점수가 보입니다.");
    } catch (err) {
      add(`❌ 오류: ${String(err)}`);
    } finally {
      setBackfilling(false);
    }
  };

  /** 어디서 막혔는지 사실로 확인하기 위한 진단 */
  const runDiagnosis = async () => {
    setDiagnosing(true);
    setLog([]);
    try {
      add("① Firebase 설정");
      add(`   환경변수 적용: ${isFirebaseEnabled ? "예" : "아니오 (Netlify 변수 미반영)"}`);

      add("② Firebase 로그인 상태");
      const fbUser = auth?.currentUser;
      if (fbUser) {
        add(`   ✅ 로그인됨 — uid: ${fbUser.uid}`);
        if (fbUser.uid !== user?.email) {
          add(`   ⚠️ 앱 계정(${user?.email}) 과 uid 가 다릅니다`);
        }
      } else {
        add("   ❌ 로그인 안 됨 — 커스텀 토큰이 발급되지 않았습니다.");
        add("      이 상태에서는 모든 Firestore 읽기·쓰기가 차단됩니다.");
        add("      앱스크립트 testFirebaseToken 이 성공하는지 먼저 확인하세요.");
        add("      (확인 후 앱에서 로그아웃 → 다시 로그인해야 토큰이 발급됩니다)");
      }

      if (!db) { add("Firestore 미초기화"); return; }

      add("③ 데이터 건수");
      try {
        const ps = await getDocs(collection(db, "products"));
        const doneCount = ps.docs.filter((d) => d.data()?.status === "거래완료").length;
        add(`   매물 ${ps.size}건 (그중 거래완료 ${doneCount}건)`);
      } catch (e) {
        add(`   ❌ 매물 조회 실패: ${String(e)}`);
      }
      try {
        const pt = await getDocs(collection(db, "points"));
        add(`   포인트 기록 ${pt.size}건`);
        if (pt.size === 0) {
          add("      → 아래 '포인트 소급 적립 실행' 을 눌러주세요");
        }
      } catch (e) {
        add(`   ❌ 포인트 조회 실패: ${String(e)}`);
        add("      규칙이 게시되지 않았거나 로그인이 안 된 상태입니다");
      }
    } finally {
      setDiagnosing(false);
    }
  };

  if (!user) return <div className="p-6 text-[14px] text-muted">로그인이 필요해요.</div>;
  if (!isAdmin)
    return <div className="p-6 text-[14px] text-muted">관리자만 사용할 수 있는 페이지예요.</div>;

  return (
    <div className="animate-fade-in px-4 pt-5 pb-10">
      <h2 className="mb-2 text-xl font-extrabold tracking-tight">시트 → Firestore 이관</h2>
      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        구글 시트의 매물을 Firestore 로 복사합니다. 같은 매물은 덮어쓰므로
        여러 번 실행해도 중복되지 않아요. 시트 데이터는 그대로 남습니다.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke px-6 py-4 text-[15px] font-extrabold text-skin-0 disabled:opacity-50"
      >
        {running ? <Loader2 size={18} className="animate-spin" /> : null}
        {running ? "이관 중…" : "이관 시작"}
      </button>

      <div className="mt-6 rounded-oiji border border-skin-line bg-skin-1 p-4">
        <h3 className="mb-1 text-[15px] font-extrabold">🔎 진단</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          Firebase 로그인 상태와 실제 데이터 건수를 확인합니다.
          집계가 비어 보일 때 원인을 먼저 파악하세요.
        </p>
        <button
          onClick={runDiagnosis}
          disabled={diagnosing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-2 px-6 py-3.5 text-[14px] font-extrabold text-ink disabled:opacity-50"
        >
          {diagnosing ? <Loader2 size={16} className="animate-spin" /> : "🔎"}
          {diagnosing ? "확인 중…" : "진단 실행"}
        </button>
      </div>

      <div className="mt-4 rounded-oiji border border-skin-line bg-skin-1 p-4">
        <h3 className="mb-1 text-[15px] font-extrabold">포인트 소급 적립</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          이미 <b className="text-ink">거래완료</b>된 매물에 포인트를 뒤늦게 적립합니다.
          매물 1건당 한 번만 적립되므로 여러 번 눌러도 안전해요.
          완료 시각이 따로 저장돼 있지 않아 <b className="text-ink">등록일</b>을 기준 연·월로 사용합니다.
        </p>
        <button
          onClick={runBackfill}
          disabled={backfilling}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-warn/50 bg-warn/10 px-6 py-3.5 text-[14px] font-extrabold text-warn disabled:opacity-50"
        >
          {backfilling ? <Loader2 size={16} className="animate-spin" /> : "⭐"}
          {backfilling ? "적립 중…" : "포인트 소급 적립 실행"}
        </button>
      </div>

      {log.length > 0 && (
        <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-skin-line bg-skin-1 p-4 text-[12px] leading-relaxed text-ink">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
