"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { updateNickForUser } from "@/lib/sheets";
import { fetchBankInfo, saveBankInfo, type BankInfo } from "@/lib/payment";
import { useTheme } from "@/lib/theme";
import { LOCATIONS } from "@/types";
import { LogOut, MapPin, Shield, Building2, User, Loader2, Landmark, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

const BANKS = [
  "KB국민은행", "신한은행", "우리은행", "하나은행", "농협은행",
  "기업은행", "SC제일은행", "카카오뱅크", "토스뱅크", "케이뱅크",
  "새마을금고", "우체국", "기타",
];

const THEMES = [
  {
    id: "default" as const,
    name: "오이그린",
    desc: "오이마켓 기본 다크 그린",
    preview: "bg-gradient-to-br from-[#0a120d] via-[#0e1813] to-[#14241b] border border-[#22382b]",
  },
  {
    id: "galaxy" as const,
    name: "우주(갤럭시)",
    desc: "어두운 하늘에 별이 깜빡이는 신비로운 분위기",
    icon: <Sparkles size={12} className="text-purple-400" />,
    preview: "bg-gradient-to-br from-[#050510] via-[#0a0a1f] to-[#1a0a3a] border border-[#1e1e3e]",
  },
  {
    id: "paper" as const,
    name: "종이",
    desc: "베이지 종이 질감, 눈이 편안한 따뜻한 톤",
    icon: <FileText size={12} className="text-amber-700" />,
    preview: "border border-amber-200",
    previewStyle: { background: "radial-gradient(at 30% 30%, rgba(248,240,218,0.7), transparent 60%), radial-gradient(at 70% 70%, rgba(180,165,130,0.4), transparent 55%), rgb(223,212,186)" },
  },
] as const;

export default function MePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [bankInfo, setBankInfo] = useState<BankInfo>({ bankName: "", accountNumber: "", holderName: "" });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    fetchBankInfo(user.email).then((info) => {
      if (info) setBankInfo(info);
    });
  }, [user?.email]);

  if (!user) return null;

  // 기타: 목록에 없는 값은 커스텀 입력으로 처리
  const isCustomLoc = !(LOCATIONS as readonly string[]).includes(user.loc);
  const locSelectValue = isCustomLoc ? "기타" : user.loc;

  const handleSignOut = () => {
    signOut();
    toast("로그아웃했어요");
    router.replace("/login");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNickForUser(user.email, user.nick);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast("프로필을 저장했어요 🥒 내 매물의 닉네임도 업데이트됐어요!");
    } catch {
      toast.error("저장 중 오류가 발생했어요");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBank = async () => {
    if (!bankInfo.bankName || !bankInfo.accountNumber || !bankInfo.holderName) {
      toast.error("은행명, 계좌번호, 예금주를 모두 입력해주세요");
      return;
    }
    setSavingBank(true);
    try {
      await saveBankInfo(user.email, bankInfo);
      toast("계좌 정보를 저장했어요. 구매자가 계좌이체 시 이 정보가 사용돼요.");
    } catch {
      toast.error("저장 중 오류가 발생했어요");
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <div className="animate-fade-in px-4 pt-5 pb-8">
      <h2 className="mb-5 text-xl font-extrabold tracking-tight">내정보</h2>

      {/* 프로필 카드 */}
      <div className="mb-5 rounded-oiji border border-skin-line bg-skin-1 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cuke text-2xl font-extrabold text-skin-0">
            {user.nick.charAt(0)}
          </div>
          <div>
            <h3 className="text-[17px] font-extrabold">{user.nick}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
              <MapPin size={12} /> {user.loc}
            </p>
            {user.dept && (
              <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
                <Building2 size={12} /> {user.dept}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-skin-2 px-3 py-2 text-[12px] text-muted">
          <User size={13} className="text-cuke" />
          {user.email}
        </div>
      </div>

      {/* 닉네임 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">
          닉네임
          <span className="ml-2 text-[11px] font-normal text-muted">매물·채팅에서 다른 사람에게 보이는 이름</span>
        </label>
        <input
          type="text"
          value={user.nick}
          onChange={(e) => updateProfile({ nick: e.target.value })}
          placeholder="닉네임을 입력하세요"
          className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        />
      </div>

      {/* 소속 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">
          <Building2 size={13} className="mr-1 inline text-cuke" />
          소속
        </label>
        <input
          type="text"
          value={user.dept || ""}
          onChange={(e) => updateProfile({ dept: e.target.value })}
          placeholder="예: IT운영팀, 경영기획팀"
          className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        />
      </div>

      {/* 근무지 */}
      <div className="mb-6">
        <label className="mb-2 block text-[13px] font-bold">근무지 (픽업 위치)</label>
        <select
          value={locSelectValue}
          onChange={(e) => {
            if (e.target.value === "기타") updateProfile({ loc: "" });
            else updateProfile({ loc: e.target.value });
          }}
          className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        >
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {(locSelectValue === "기타" || isCustomLoc) && (
          <input
            type="text"
            value={user.loc}
            onChange={(e) => updateProfile({ loc: e.target.value })}
            placeholder="위치를 직접 입력하세요 (예: 마포 오피스)"
            className="mt-2 w-full rounded-xl border border-cuke/50 bg-skin-1 px-4 py-3 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
            autoFocus
          />
        )}
      </div>

      {/* 프로필 저장 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : null}
        {saving ? "저장 중..." : "프로필 저장"}
      </button>

      {/* ── 화면 테마 ── */}
      <div className="mb-8 rounded-oiji border border-skin-line bg-skin-1 p-5">
        <h4 className="mb-1 text-[14px] font-extrabold">🎨 화면 테마</h4>
        <p className="mb-4 text-[11px] text-muted">배경 테마를 선택하면 즉시 적용됩니다.</p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                  active ? "border-cuke ring-2 ring-cuke/30" : "border-skin-line hover:border-cuke/40"
                }`}
              >
                <div
                  className={`mb-2 h-14 rounded-lg ${t.preview}`}
                  style={"previewStyle" in t ? t.previewStyle : undefined}
                />
                <p className="flex items-center gap-1 text-[12px] font-bold text-ink">
                  {"icon" in t ? t.icon : null}
                  {t.name}
                  {active && <span className="ml-auto text-cuke">✓</span>}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted">{t.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted">테마 설정은 현재 디바이스에만 적용됩니다.</p>
      </div>

      {/* ── 계좌 정보 ── */}
      <div className="mb-8 rounded-oiji border border-skin-line bg-skin-1 p-5">
        <h4 className="mb-1 flex items-center gap-2 text-[14px] font-extrabold">
          <Landmark size={15} className="text-blue-400" />
          계좌 정보
        </h4>
        <p className="mb-4 text-[11px] text-muted">
          구매자가 계좌이체를 선택할 때 자동으로 공유됩니다
        </p>

        <div className="mb-3">
          <label className="mb-1.5 block text-[12px] font-bold text-muted">은행</label>
          <select
            value={bankInfo.bankName}
            onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
            className="w-full appearance-none rounded-xl border border-skin-line bg-skin-2 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
          >
            <option value="">은행 선택</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[12px] font-bold text-muted">계좌번호</label>
          <input
            type="text"
            inputMode="numeric"
            value={bankInfo.accountNumber}
            onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
            placeholder="숫자만 입력 (예: 1234-56-789012)"
            className="w-full rounded-xl border border-skin-line bg-skin-2 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12px] font-bold text-muted">예금주</label>
          <input
            type="text"
            value={bankInfo.holderName}
            onChange={(e) => setBankInfo({ ...bankInfo, holderName: e.target.value })}
            placeholder="예금주 이름"
            className="w-full rounded-xl border border-skin-line bg-skin-2 px-4 py-3 text-[14px] text-ink outline-none focus:border-cuke"
          />
        </div>

        <button
          onClick={handleSaveBank}
          disabled={savingBank}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 py-3 text-[14px] font-bold text-blue-300 disabled:opacity-50"
        >
          {savingBank ? <Loader2 size={15} className="animate-spin" /> : null}
          계좌 정보 저장
        </button>
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-1 px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:border-red-500/50 hover:text-red-400"
      >
        <LogOut size={18} />
        로그아웃
      </button>

      {/* 프라이버시 안내 */}
      <div className="mt-8 rounded-oiji bg-skin-2 p-4">
        <h4 className="flex items-center gap-2 text-[13px] font-bold text-muted">
          <Shield size={13} /> 프라이버시
        </h4>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          실명과 이메일은 다른 직원에게 <b className="text-ink">절대 노출되지 않습니다</b>.
          닉네임과 근무지만 매물에 표시됩니다.
        </p>
      </div>

      <div className="mt-6 text-center text-[11px] text-muted">
        <p>🥒 오이(52)지마켓 v0.2.0</p>
        <p className="mt-1">사내 전산소모품·사무용품 나눔/재판매</p>
      </div>
    </div>
  );
}
