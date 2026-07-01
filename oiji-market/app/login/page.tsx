"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Mail, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

async function postToScript(payload: object) {
  if (!APPS_SCRIPT_URL) {
    // 데모 모드: 바로 성공
    await new Promise((r) => setTimeout(r, 800));
    return { ok: true, email: (payload as { email?: string }).email };
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 이미 로그인 → 홈으로
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  // 타이머
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const isValidEmail = /^[^\s@]+@gsretail\.com$/i.test(email);

  const handleSendOtp = async () => {
    if (!isValidEmail) {
      toast.error("@gsretail.com 이메일만 사용할 수 있어요");
      return;
    }
    setSending(true);
    try {
      const res = await postToScript({ action: "sendOtp", email: email.trim().toLowerCase() });
      if (res.ok) {
        setStep("code");
        setCountdown(300); // 5분
        toast("📧 인증번호를 발송했어요. 이메일을 확인해주세요!");
        setTimeout(() => codeRefs.current[0]?.focus(), 200);
      } else {
        toast.error(res.error || "발송에 실패했어요");
      }
    } catch {
      toast.error("네트워크 오류. 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return; // 숫자만
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);

    // 다음 칸 자동 이동
    if (val && idx < 5) {
      codeRefs.current[idx + 1]?.focus();
    }

    // 6자리 완성 시 자동 검증
    if (next.every((c) => c) && idx === 5) {
      verifyCode(next.join(""));
    }
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter" && code.every((c) => c)) {
      verifyCode(code.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(paste)) {
      e.preventDefault();
      const next = paste.split("");
      setCode(next);
      codeRefs.current[5]?.focus();
      setTimeout(() => verifyCode(paste), 100);
    }
  };

  const verifyCode = async (fullCode: string) => {
    setVerifying(true);
    try {
      const res = await postToScript({
        action: "verifyOtp",
        email: email.trim().toLowerCase(),
        code: fullCode,
      });
      if (res.ok) {
        signIn(res.email || email.trim().toLowerCase());
        toast("🥒 로그인 성공! 환영해요!");
        router.replace("/");
      } else {
        toast.error(res.error || "인증에 실패했어요");
        setCode(["", "", "", "", "", ""]);
        codeRefs.current[0]?.focus();
      }
    } catch {
      toast.error("네트워크 오류. 다시 시도해주세요.");
    } finally {
      setVerifying(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (user) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-skin-0 px-6">
      <div className="w-full max-w-sm">
        {/* 배너 이미지 */}
        <div className="mb-8 overflow-hidden rounded-3xl shadow-xl shadow-black/20">
          <img
            src="/banner-login.png"
            alt="오이(52)지마켓"
            className="w-full object-cover"
            draggable={false}
          />
        </div>

        {step === "email" ? (
          /* ── 이메일 입력 ── */
          <div className="animate-fade-in">
            <label className="mb-2 block text-[13px] font-bold text-ink">
              <Mail size={14} className="mr-1.5 inline text-cuke" />
              사내 이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              placeholder="name@gsretail.com"
              autoFocus
              className="mb-2 w-full rounded-2xl border border-skin-line bg-skin-1 px-4 py-4 text-[16px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-cuke"
            />
            <p className="mb-6 text-[12px] text-muted">
              @gsretail.com 이메일로 인증번호가 발송됩니다
            </p>

            <button
              onClick={handleSendOtp}
              disabled={!isValidEmail || sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> 발송 중...
                </>
              ) : (
                <>
                  인증번호 받기 <ArrowRight size={18} />
                </>
              )}
            </button>

            {!APPS_SCRIPT_URL && (
              <p className="mt-4 rounded-xl bg-warn/10 px-3 py-2 text-center text-[11px] text-warn">
                데모 모드 — Apps Script 미설정. 아무 @gsretail.com 이메일 + 아무 6자리로 로그인 가능
              </p>
            )}
          </div>
        ) : (
          /* ── 인증번호 입력 ── */
          <div className="animate-fade-in">
            <div className="mb-2 text-center">
              <KeyRound size={18} className="mx-auto mb-2 text-cuke" />
              <h2 className="text-[17px] font-extrabold text-ink">인증번호 입력</h2>
              <p className="mt-1.5 text-[13px] text-muted">
                <span className="font-semibold text-cuke-bright">{email}</span>
                으로 발송된 6자리 번호를 입력하세요
              </p>
            </div>

            {/* 6자리 코드 입력 */}
            <div className="my-6 flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="h-14 w-12 rounded-xl border border-skin-line bg-skin-1 text-center text-2xl font-extrabold text-cuke outline-none transition-all focus:border-cuke focus:ring-2 focus:ring-cuke/30"
                />
              ))}
            </div>

            {/* 남은 시간 */}
            {countdown > 0 && (
              <p className="mb-4 text-center text-[13px] text-muted">
                남은 시간: <span className="font-bold text-ink">{formatTime(countdown)}</span>
              </p>
            )}

            {/* 검증 버튼 */}
            <button
              onClick={() => verifyCode(code.join(""))}
              disabled={!code.every((c) => c) || verifying}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cuke px-6 py-4 text-[16px] font-extrabold text-skin-0 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {verifying ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> 확인 중...
                </>
              ) : (
                "로그인"
              )}
            </button>

            {/* 재전송 */}
            <button
              onClick={() => {
                setStep("email");
                setCode(["", "", "", "", "", ""]);
              }}
              className="mt-4 w-full text-center text-[13px] text-muted underline transition-colors hover:text-cuke"
            >
              다른 이메일로 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
