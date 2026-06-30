"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Crown, Star, Gift, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { fetchRanking, setMonthlyNanumi, type UserStat } from "@/lib/ranking";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Tab = "종합" | "나눔왕" | "판매왕";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = [
  "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
  "from-slate-400/20 to-slate-500/5 border-slate-400/30",
  "from-amber-700/20 to-amber-800/5 border-amber-700/30",
];

const ADMIN_EMAILS = ["herhero78@gmail.com"];

function getSortedList(ranking: UserStat[], tab: Tab): UserStat[] {
  const copy = [...ranking];
  if (tab === "나눔왕") return copy.sort((a, b) => b.nanum - a.nanum || b.points - a.points);
  if (tab === "판매왕") return copy.sort((a, b) => b.sale - a.sale || b.points - a.points);
  return copy.sort((a, b) => b.points - a.points);
}

function getTabScore(user: UserStat, tab: Tab) {
  if (tab === "나눔왕") return { value: user.nanum, label: "나눔" };
  if (tab === "판매왕") return { value: user.sale, label: "판매" };
  return { value: user.points, label: "점" };
}

export default function RankingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || "");

  const [tab, setTab] = useState<Tab>("종합");
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedUid, setSelectedUid] = useState("");
  const [selectedNick, setSelectedNick] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthLabel = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ranking"],
    queryFn: fetchRanking,
    staleTime: 60_000,
  });

  const ranking = data?.ranking ?? [];
  const monthly = data?.monthlyNanumi;
  const sorted = getSortedList(ranking, tab);

  const handleSetNanumi = async () => {
    if (!selectedUid) { toast.error("수상자를 선택하세요"); return; }
    setSubmitting(true);
    try {
      const res = await setMonthlyNanumi({ uid: selectedUid, nick: selectedNick, month: currentMonth, reason });
      if (res.ok) {
        toast("🏆 GS나누미가 선정됐어요!");
        queryClient.invalidateQueries({ queryKey: ["ranking"] });
        setShowAdmin(false);
      } else {
        toast.error("선정에 실패했어요");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in px-4 pt-5 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cuke/20 text-xl">🏆</div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">GS나누미 랭킹</h2>
          <p className="text-[12px] text-muted">{currentMonthLabel} 기준</p>
        </div>
      </div>

      {/* ── 이달의 GS나누미 ── */}
      {monthly && monthly.month === currentMonth && (
        <div className="mb-5 overflow-hidden rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/15 via-amber-500/5 to-transparent p-5">
          <div className="mb-2 flex items-center gap-2 text-yellow-400">
            <Crown size={18} className="fill-yellow-400" />
            <span className="text-[13px] font-extrabold uppercase tracking-wider">
              이달의 GS나누미 — {currentMonthLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/20 text-3xl font-extrabold text-yellow-300">
              {monthly.nick.charAt(0)}
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-yellow-300">@{monthly.nick}</p>
              {monthly.reason && (
                <p className="mt-1 text-[13px] leading-snug text-yellow-200/70">"{monthly.reason}"</p>
              )}
            </div>
            <Gift size={36} className="ml-auto text-yellow-400/60" />
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-yellow-500/10 px-3 py-2 text-[12px] text-yellow-300">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            관리자가 선정한 이달의 나눔 히어로에게 선물이 전달됩니다
          </div>
        </div>
      )}

      {/* ── 포인트 시스템 ── */}
      <div className="mb-5 rounded-2xl border border-skin-line bg-skin-1 p-4">
        <p className="mb-3 text-[13px] font-extrabold text-muted">💡 포인트 시스템</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-cuke/10 py-3">
            <p className="text-2xl font-extrabold text-cuke">+3점</p>
            <p className="mt-0.5 text-[12px] text-muted">나눔 등록 1건</p>
          </div>
          <div className="rounded-xl bg-pay/10 py-3">
            <p className="text-2xl font-extrabold text-pay">+2점</p>
            <p className="mt-0.5 text-[12px] text-muted">판매 등록 1건</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          나눔·판매가 많을수록 높은 점수 — 거래완료 전도 카운트됩니다
        </p>
      </div>

      {/* ── 탭 ── */}
      <div className="mb-4 flex gap-2">
        {(["종합", "나눔왕", "판매왕"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full border py-2.5 text-[13px] font-bold transition-all ${
              tab === t ? "border-cuke bg-cuke text-skin-0" : "border-skin-line text-muted"
            }`}
          >
            {t === "종합" ? "🏆 종합" : t === "나눔왕" ? "🎁 나눔왕" : "💰 판매왕"}
          </button>
        ))}
      </div>

      {/* ── 리더보드 ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-cuke" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl">🥒</span>
          <p className="font-bold text-muted">아직 매물이 없어요</p>
          <p className="text-[13px] text-muted">첫 번째 랭커가 돼보세요!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((u, idx) => {
            const score = getTabScore(u, tab);
            const isTop3 = idx < 3;
            const isWinner = monthly?.uid === u.uid && monthly?.month === currentMonth;

            return (
              <div
                key={u.uid}
                className={`relative overflow-hidden rounded-2xl border transition-all ${
                  isTop3
                    ? `bg-gradient-to-r ${RANK_COLORS[idx]}`
                    : "border-skin-line bg-skin-1"
                }`}
              >
                {isWinner && (
                  <div className="absolute right-3 top-2 flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                    <Crown size={10} className="fill-yellow-400" /> 이달의 나누미
                  </div>
                )}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  {/* 순위 */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center text-center ${
                    isTop3 ? "text-2xl" : "text-[15px] font-extrabold text-muted"
                  }`}>
                    {isTop3 ? RANK_MEDALS[idx] : `${idx + 1}`}
                  </div>

                  {/* 아바타 */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] font-extrabold ${
                    isTop3 ? "bg-white/10 text-white" : "bg-skin-2 text-cuke-bright"
                  }`}>
                    {u.nick.charAt(0)}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-extrabold truncate ${isTop3 ? "text-[16px] text-white" : "text-[15px] text-ink"}`}>
                      @{u.nick}
                    </p>
                    <div className="mt-0.5 flex gap-2 text-[11px]">
                      <span className={isTop3 ? "text-white/60" : "text-muted"}>
                        나눔 {u.nanum}건
                      </span>
                      <span className={isTop3 ? "text-white/60" : "text-muted"}>
                        판매 {u.sale}건
                      </span>
                      <span className={isTop3 ? "text-white/60" : "text-muted"}>
                        합계 {u.total}건
                      </span>
                    </div>
                  </div>

                  {/* 점수 */}
                  <div className="text-right">
                    <p className={`text-[22px] font-extrabold tabular-nums ${
                      isTop3 ? "text-white" : "text-cuke-bright"
                    }`}>
                      {score.value}
                    </p>
                    <p className={`text-[11px] ${isTop3 ? "text-white/60" : "text-muted"}`}>
                      {score.label}
                    </p>
                  </div>
                </div>

                {/* 상위 3위 장식 바 */}
                {isTop3 && (
                  <div className={`h-0.5 w-full ${
                    idx === 0 ? "bg-yellow-400/40" : idx === 1 ? "bg-slate-400/40" : "bg-amber-700/40"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 관리자 패널 ── */}
      {isAdmin && (
        <div className="mt-8">
          <button
            onClick={() => setShowAdmin((p) => !p)}
            className="flex w-full items-center justify-between rounded-2xl border border-cuke/30 bg-cuke/5 px-5 py-4"
          >
            <span className="flex items-center gap-2 text-[14px] font-bold text-cuke">
              <Trophy size={17} />
              관리자: GS나누미 선정
            </span>
            <ChevronRight size={18} className={`text-cuke transition-transform ${showAdmin ? "rotate-90" : ""}`} />
          </button>

          {showAdmin && (
            <div className="mt-3 rounded-2xl border border-skin-line bg-skin-1 p-5">
              <p className="mb-4 text-[13px] font-bold text-muted">
                🏆 {currentMonthLabel} GS나누미 선정
              </p>

              <label className="mb-1.5 block text-[13px] font-bold">수상자 선택</label>
              <select
                value={selectedUid}
                onChange={(e) => {
                  const u = ranking.find((r) => r.uid === e.target.value);
                  setSelectedUid(e.target.value);
                  setSelectedNick(u?.nick || "");
                }}
                className="mb-4 w-full appearance-none rounded-xl border border-skin-line bg-skin-0 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
              >
                <option value="">-- 수상자를 선택하세요 --</option>
                {[...ranking].sort((a, b) => b.points - a.points).map((u) => (
                  <option key={u.uid} value={u.uid}>
                    @{u.nick} ({u.points}점 · 나눔{u.nanum} 판매{u.sale})
                  </option>
                ))}
              </select>

              <label className="mb-1.5 block text-[13px] font-bold">선정 이유 (선택)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="예: 5건 나눔으로 사무실 소모품 절약에 기여!"
                className="mb-4 w-full resize-none rounded-xl border border-skin-line bg-skin-0 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
              />

              {selectedUid && (
                <div className="mb-4 rounded-xl bg-cuke/10 p-3 text-[13px]">
                  <p className="font-bold text-cuke">선정 예정: @{selectedNick}</p>
                  <p className="mt-0.5 text-muted">
                    {reason || "이유 없음"} · {currentMonthLabel}
                  </p>
                </div>
              )}

              <button
                onClick={handleSetNanumi}
                disabled={submitting || !selectedUid}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke py-4 text-[15px] font-extrabold text-skin-0 disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                이달의 GS나누미 확정
              </button>
            </div>
          )}
        </div>
      )}

      {/* 빈 공간 패딩 */}
      <div className="h-6" />
    </div>
  );
}
