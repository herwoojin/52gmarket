"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/lib/notifications";
import { Bell, Plus, X } from "lucide-react";
import { toast } from "sonner";

export default function NotiPage() {
  const { notifications, markAllRead } = useNotifications();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");

  // localStorage에서 키워드 복원
  useEffect(() => {
    const stored = localStorage.getItem("oiji-keywords");
    if (stored) setKeywords(JSON.parse(stored));
  }, []);

  const saveKeywords = (kws: string[]) => {
    setKeywords(kws);
    localStorage.setItem("oiji-keywords", JSON.stringify(kws));
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
    if (!("Notification" in window)) {
      toast("이 브라우저는 알림을 지원하지 않아요");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      toast("🔔 푸시 알림이 켜졌어요!");
      new window.Notification("오이지마켓", {
        body: "이제 찾는 물건이 올라오면 바로 알려드릴게요!",
      });
    } else {
      toast("알림 권한이 거부되었어요");
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
        className="mb-5 w-full rounded-2xl border border-skin-line bg-skin-1 px-4 py-3.5 text-[14px] font-bold text-ink transition-colors hover:border-cuke"
      >
        🔔 푸시 알림 켜기
      </button>

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
