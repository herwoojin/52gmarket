"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";
import { fetchKeywords, saveKeywords as saveKeywordsRemote } from "@/lib/keywords";
import { requestPushPermission, isPushEnabled, isPushConfigured } from "@/lib/push";
import { Bell, Plus, X } from "lucide-react";
import { toast } from "sonner";

export default function NotiPage() {
  const { notifications, markAllRead } = useNotifications();
  const { user } = useAuth();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [checkingPush, setCheckingPush] = useState(true);

  // 서버(계정 기준)에서 키워드 복원 — 어떤 기기서든 동일하게 보임
  useEffect(() => {
    if (!user?.email) return;
    fetchKeywords(user.email).then((kws) => {
      if (kws.length > 0) setKeywords(kws);
    });
  }, [user?.email]);

  useEffect(() => {
    isPushEnabled().then((v) => {
      setPushEnabled(v);
      setCheckingPush(false);
    });
  }, []);

  const saveKeywords = (kws: string[]) => {
    setKeywords(kws);
    if (user?.email) saveKeywordsRemote(user.email, kws);
  };

  const addKeyword = () => {
    const word = kwInput.trim();
    if (!word) return;
    if (keywords.includes(word)) {
      toast("이미 등록된 키워드예요");
      return;
    }
    saveKeywords([...keywords, word]);
    setKwInput("");
    toast(`🔔 '${word}' 키워드 알림 등록!`);
  };

  const removeKeyword = (idx: number) => {
    const next = keywords.filter((_, i) => i !== idx);
    saveKeywords(next);
    toast("키워드를 삭제했어요");
  };

  const enablePush = async () => {
    if (!isPushConfigured) {
      toast.error("푸시 알림이 아직 설정되지 않았어요");
      return;
    }
    const granted = await requestPushPermission();
    if (granted) {
      setPushEnabled(true);
      toast("🔔 푸시 알림이 켜졌어요! 새 매물·채팅이 오면 알려드려요.");
    } else {
      toast.error("알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.");
    }
  };

  // 페이지 진입 시 모두 읽음 처리
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <div className="animate-fade-in px-4 pt-5 pb-8">
      <h2 className="mb-5 text-xl font-extrabold tracking-tight">알림</h2>

      {/* 키워드 등록 */}
      <div className="mb-5 rounded-oiji border border-skin-line bg-skin-1 p-4">
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <Bell size={14} className="text-cuke" />
          키워드 알림
        </div>
        <p className="mt-1 text-[12px] text-muted">
          등록한 키워드와 매칭되는 매물이 올라오면 알려드려요
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="예: 토너, A4용지"
            className="flex-1 rounded-xl border border-skin-line bg-skin-2 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-cuke"
          />
          <button
            onClick={addKeyword}
            className="shrink-0 rounded-xl bg-cuke px-4 text-[14px] font-extrabold text-skin-0"
          >
            <Plus size={16} />
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {keywords.map((kw, i) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 rounded-full border border-cuke bg-skin-2 px-3 py-1.5 text-[13px] font-semibold"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(i)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-muted"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 푸시 알림 */}
      <button
        onClick={enablePush}
        disabled={pushEnabled || checkingPush}
        className={`mb-5 w-full rounded-2xl border px-4 py-3.5 text-[14px] font-bold transition-colors disabled:cursor-default ${
          pushEnabled
            ? "border-cuke bg-cuke/10 text-cuke"
            : "border-skin-line bg-skin-1 text-ink hover:border-cuke"
        }`}
      >
        {checkingPush ? "확인 중..." : pushEnabled ? "✅ 푸시 알림 켜짐" : "🔔 푸시 알림 켜기"}
      </button>
      {!isPushConfigured && (
        <p className="-mt-3 mb-5 text-[11px] text-muted">
          아직 관리자가 푸시 알림을 설정하지 않았어요
        </p>
      )}

      {/* 알림 목록 */}
      <div className="flex items-center gap-2 text-[13px] font-bold text-muted">
        <div className="h-1.5 w-1.5 rounded-full bg-cuke" />
        받은 알림
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-4xl">🔕</span>
          <p className="text-[14px] font-bold text-muted">아직 알림이 없어요</p>
          <p className="text-[12px] text-muted">
            키워드를 등록하면 매칭 매물이 올라올 때 알려드려요
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {notifications.map((noti) => (
            <div
              key={noti.id}
              className={`flex gap-3 rounded-oiji border p-3.5 ${
                noti.unread
                  ? "border-cuke/40 bg-cuke/5"
                  : "border-skin-line bg-skin-1"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-skin-2 text-lg">
                🥒
              </div>
              <div>
                <p className="text-[13px] font-bold">
                  &apos;{noti.keyword}&apos; 키워드 매물이 올라왔어요
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {noti.title} · 📍{noti.loc}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
