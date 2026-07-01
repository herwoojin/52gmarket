"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { updateNickForUser } from "@/lib/sheets";
import { LOCATIONS } from "@/types";
import { LogOut, MapPin, Shield, Building2, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

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

        {/* 로그인 이메일 */}
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

      {/* 소속 (부서) */}
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
          value={user.loc}
          onChange={(e) => updateProfile({ loc: e.target.value })}
          className="w-full appearance-none rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        >
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* 프로필 저장 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : null}
        {saving ? "저장 중..." : "프로필 저장"}
      </button>

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

      {/* 앱 정보 */}
      <div className="mt-6 text-center text-[11px] text-muted">
        <p>🥒 오이(52)지마켓 v0.2.0</p>
        <p className="mt-1">사내 전산소모품·사무용품 나눔/재판매</p>
      </div>
    </div>
  );
}
