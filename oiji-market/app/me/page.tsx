"use client";

import { useAuth } from "@/lib/auth";
import { LOCATIONS } from "@/types";
import { LogIn, LogOut, User, MapPin, Shield } from "lucide-react";
import { toast } from "sonner";

export default function MePage() {
  const { user, profile, isDemoMode, signIn, signOut, updateProfile } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn();
      toast("🥒 로그인 성공!");
    } catch (err) {
      toast.error("로그인에 실패했어요");
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast("로그아웃했어요");
    } catch (err) {
      toast.error("로그아웃에 실패했어요");
    }
  };

  return (
    <div className="animate-fade-in px-4 pt-5 pb-8">
      <h2 className="mb-5 text-xl font-extrabold tracking-tight">내정보</h2>

      {/* 프로필 카드 */}
      <div className="mb-5 rounded-oiji border border-skin-line bg-skin-1 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cuke text-2xl font-extrabold text-skin-0">
            {profile.nick.charAt(0)}
          </div>
          <div>
            <h3 className="text-[17px] font-extrabold">{profile.nick}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
              <MapPin size={12} /> {profile.loc}
            </p>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 text-[12px] text-warn">
            <Shield size={13} />
            데모 모드 — Firebase 설정 후 로그인 가능
          </div>
        )}
      </div>

      {/* 닉네임 */}
      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-bold">닉네임</label>
        <input
          type="text"
          value={profile.nick}
          onChange={(e) => updateProfile({ nick: e.target.value })}
          className="w-full rounded-xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[15px] text-ink outline-none transition-colors focus:border-cuke"
        />
      </div>

      {/* 근무지 */}
      <div className="mb-6">
        <label className="mb-2 block text-[13px] font-bold">근무지 (픽업 위치)</label>
        <select
          value={profile.loc}
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
        onClick={() => toast("프로필을 저장했어요 🥒")}
        className="mb-5 w-full rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98]"
      >
        프로필 저장
      </button>

      {/* 구글 로그인/로그아웃 */}
      {!isDemoMode && (
        <>
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-1 px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:border-cuke"
            >
              <LogOut size={18} />
              로그아웃
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-skin-line bg-skin-1 px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:border-cuke"
            >
              <LogIn size={18} />
              구글로 로그인
            </button>
          )}
        </>
      )}

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
        <p>🥒 오이(52)지마켓 v0.1.0</p>
        <p className="mt-1">사내 전산소모품·사무용품 나눔/재판매</p>
      </div>
    </div>
  );
}
