"use client";

import { useState, useEffect, useRef } from "react";
import type { Product } from "@/types";
import { X, Loader2, Copy, Check, CreditCard, Building2, AlertCircle, BadgeCheck } from "lucide-react";
import {
  fetchBankInfo,
  notifyPaymentSent,
  confirmDeposit,
  createStripeIntent,
  loadScript,
  type BankInfo,
} from "@/lib/payment";
import { toast } from "sonner";

/* ── 환경 변수 ── */
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

type Step =
  | "method"
  | "account"
  | "account_sent"
  | "card_select"
  | "stripe_form"
  | "done";

interface PaymentSheetProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  currentNick: string;
  currentUid: string;
  onDone?: (productId: string) => void;
}

export default function PaymentSheet({
  product,
  isOpen,
  onClose,
  currentNick,
  currentUid,
  onDone,
}: PaymentSheetProps) {
  const [step, setStep] = useState<Step>("method");
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState<"account" | null>(null);
  const [stripeElements, setStripeElements] = useState<unknown>(null);
  const [stripeInstance, setStripeInstance] = useState<unknown>(null);
  const paypalRendered = useRef(false);
  const stripeElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep("method");
      setBankInfo(null);
      paypalRendered.current = false;
      setStripeElements(null);
      setStripeInstance(null);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const price = product.price;
  const orderId = `oiji-${product.id}-${Date.now()}`;

  /* ── 계좌이체 ── */
  const selectAccount = async () => {
    setStep("account");
    setLoadingBank(true);
    const info = await fetchBankInfo(product.uid);
    setBankInfo(info);
    setLoadingBank(false);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("account");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("복사 실패");
    }
  };

  const handlePaymentSent = async () => {
    setProcessing(true);
    try {
      await notifyPaymentSent(product.id);
      setStep("account_sent");
      toast("입금 완료 통보를 판매자에게 전달했어요!");
    } catch {
      toast.error("오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setProcessing(false);
    }
  };

  /* ── 토스페이먼츠 ── */
  const handleToss = async () => {
    if (!TOSS_CLIENT_KEY) {
      toast.error("토스페이먼츠 클라이언트 키가 설정되지 않았어요");
      return;
    }
    setProcessing(true);
    try {
      await loadScript("https://js.tosspayments.com/v1/payment", "toss-sdk");
      const toss = (window as unknown as { TossPayments: (key: string) => unknown }).TossPayments(TOSS_CLIENT_KEY);
      await (toss as { requestPayment: (method: string, opts: unknown) => Promise<void> }).requestPayment("카드", {
        amount: price,
        orderId,
        orderName: product.title,
        customerName: currentNick,
        customerEmail: currentUid,
        successUrl: `${window.location.origin}/payment/success?productId=${product.id}&method=toss`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== "USER_CANCEL") {
        toast.error(err?.message || "결제에 실패했어요");
      }
    } finally {
      setProcessing(false);
    }
  };

  /* ── 페이팔 ── */
  const handlePaypalMount = (container: HTMLDivElement | null) => { void (async () => {
    if (!container || !PAYPAL_CLIENT_ID || paypalRendered.current) return;
    paypalRendered.current = true;
    try {
      await loadScript(
        `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=KRW`,
        "paypal-sdk"
      );
      const paypal = (window as unknown as { paypal: { Buttons: (opts: unknown) => { render: (el: HTMLDivElement) => void } } }).paypal;
      paypal.Buttons({
        createOrder: (_: unknown, actions: { order: { create: (o: unknown) => Promise<string> } }) =>
          actions.order.create({
            purchase_units: [{ amount: { value: String(price), currency_code: "KRW" } }],
          }),
        onApprove: async (_: unknown, actions: { order: { capture: () => Promise<unknown> } }) => {
          await actions.order.capture();
          setProcessing(true);
          await confirmDeposit(product.id);
          setStep("done");
          onDone?.(product.id);
          setProcessing(false);
        },
        onError: () => toast.error("페이팔 결제에 실패했어요"),
      }).render(container);
    } catch {
      toast.error("페이팔 SDK 로딩에 실패했어요");
    }
  })(); };

  /* ── 스트라이프 ── */
  const handleStripeInit = async () => {
    if (!STRIPE_PK) {
      toast.error("스트라이프 키가 설정되지 않았어요");
      return;
    }
    setProcessing(true);
    try {
      const clientSecret = await createStripeIntent(price);
      if (!clientSecret) throw new Error("PaymentIntent 생성 실패");

      await loadScript("https://js.stripe.com/v3/", "stripe-sdk");
      const stripe = (window as unknown as { Stripe: (key: string) => unknown }).Stripe(STRIPE_PK);
      const elements = (stripe as { elements: (o: unknown) => unknown }).elements({ clientSecret });
      setStripeInstance(stripe);
      setStripeElements(elements);
      setStep("stripe_form");

      setTimeout(() => {
        if (!stripeElRef.current) return;
        (elements as { create: (t: string) => { mount: (el: HTMLDivElement) => void } })
          .create("payment")
          .mount(stripeElRef.current);
      }, 100);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleStripeConfirm = async () => {
    if (!stripeInstance || !stripeElements) return;
    setProcessing(true);
    const { error } = await (stripeInstance as {
      confirmPayment: (o: unknown) => Promise<{ error?: { message: string } }>;
    }).confirmPayment({
      elements: stripeElements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success?productId=${product.id}&method=stripe`,
      },
    });
    if (error) {
      toast.error(error.message || "결제에 실패했어요");
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-[920px] flex-col rounded-t-3xl border-t border-skin-line bg-skin-1 shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* 핸들 + 헤더 */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-skin-line" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <div>
            <h3 className="text-[16px] font-extrabold">결제하기</h3>
            <p className="text-[12px] text-muted line-clamp-1">{product.title}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-skin-2 text-muted">
            <X size={18} />
          </button>
        </div>

        {/* 가격 배너 */}
        <div className="mx-5 mb-4 rounded-2xl bg-skin-2 px-4 py-3 text-center">
          <p className="text-[13px] text-muted">결제 금액</p>
          <p className="text-[24px] font-extrabold text-ink">{price.toLocaleString()}원</p>
        </div>

        {/* ── 컨텐츠 ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">

          {/* STEP: 결제 방법 선택 */}
          {step === "method" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={selectAccount}
                className="flex items-center gap-4 rounded-2xl border border-skin-line bg-skin-1 p-5 text-left transition-colors hover:border-cuke/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                  <Building2 size={22} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-extrabold text-ink">계좌이체</p>
                  <p className="text-[12px] text-muted">판매자 계좌로 직접 송금</p>
                </div>
              </button>

              <button
                onClick={() => setStep("card_select")}
                className="flex items-center gap-4 rounded-2xl border border-skin-line bg-skin-1 p-5 text-left transition-colors hover:border-cuke/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15">
                  <CreditCard size={22} className="text-purple-400" />
                </div>
                <div>
                  <p className="font-extrabold text-ink">카드결제</p>
                  <p className="text-[12px] text-muted">토스페이먼츠 · 페이팔 · 스트라이프</p>
                </div>
              </button>
            </div>
          )}

          {/* STEP: 계좌이체 - 계좌 정보 */}
          {step === "account" && (
            <div>
              <button onClick={() => setStep("method")} className="mb-4 text-[13px] text-muted">← 결제 방법 변경</button>
              {loadingBank ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-cuke" />
                </div>
              ) : !bankInfo ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                  <AlertCircle size={28} className="text-amber-400" />
                  <p className="font-bold text-amber-300">판매자가 계좌 정보를 등록하지 않았어요</p>
                  <p className="text-[12px] text-muted">채팅으로 계좌 정보를 요청해보세요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-skin-line bg-skin-2 p-5">
                    <p className="mb-3 text-[12px] font-bold text-muted">판매자 계좌 정보</p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-[11px] text-muted">은행</p>
                        <p className="text-[16px] font-extrabold">{bankInfo.bankName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted">계좌번호</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[18px] font-extrabold tracking-wider">{bankInfo.accountNumber}</p>
                          <button
                            onClick={() => copyText(bankInfo.accountNumber)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-skin-1 text-muted hover:text-cuke"
                          >
                            {copied === "account" ? <Check size={15} className="text-cuke" /> : <Copy size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted">예금주</p>
                        <p className="text-[16px] font-extrabold">{bankInfo.holderName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-cuke/10 px-4 py-3 text-center">
                    <p className="text-[13px] font-bold text-cuke">
                      위 계좌로 <span className="text-[17px]">{price.toLocaleString()}원</span>을 송금해주세요
                    </p>
                  </div>

                  <button
                    onClick={handlePaymentSent}
                    disabled={processing}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 text-[16px] font-extrabold text-white disabled:opacity-50"
                  >
                    {processing ? <Loader2 size={18} className="animate-spin" /> : null}
                    입금 완료했어요
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP: 계좌이체 - 입금 완료 통보 후 */}
          {step === "account_sent" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/15">
                <BadgeCheck size={40} className="text-blue-400" />
              </div>
              <p className="text-[18px] font-extrabold">입금 완료 통보 전송됨</p>
              <p className="text-[13px] leading-relaxed text-muted">
                판매자에게 알림이 전달됐어요.<br />
                판매자가 입금을 확인하면 거래가 완료됩니다.
              </p>
              <button
                onClick={onClose}
                className="mt-2 rounded-2xl border border-skin-line px-8 py-3 text-[14px] font-bold text-muted"
              >
                닫기
              </button>
            </div>
          )}

          {/* STEP: 카드결제 - 제공사 선택 */}
          {step === "card_select" && (
            <div>
              <button onClick={() => setStep("method")} className="mb-4 text-[13px] text-muted">← 결제 방법 변경</button>
              <div className="flex flex-col gap-3">

                {/* 토스페이먼츠 */}
                <div className="rounded-2xl border border-skin-line bg-skin-1 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0064FF]/15">
                      <span className="text-[14px] font-extrabold text-[#0064FF]">T</span>
                    </div>
                    <div>
                      <p className="font-extrabold">토스페이먼츠</p>
                      <p className="text-[11px] text-muted">신용카드 · 체크카드 · 간편결제</p>
                    </div>
                  </div>
                  {TOSS_CLIENT_KEY ? (
                    <button
                      onClick={handleToss}
                      disabled={processing}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0064FF] text-[14px] font-bold text-white disabled:opacity-50"
                    >
                      {processing ? <Loader2 size={16} className="animate-spin" /> : null}
                      토스로 결제하기
                    </button>
                  ) : (
                    <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                      NEXT_PUBLIC_TOSS_CLIENT_KEY 설정 필요
                    </div>
                  )}
                </div>

                {/* 페이팔 */}
                <div className="rounded-2xl border border-skin-line bg-skin-1 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003087]/20">
                      <span className="text-[14px] font-extrabold text-[#009CDE]">P</span>
                    </div>
                    <div>
                      <p className="font-extrabold">페이팔 PayPal</p>
                      <p className="text-[11px] text-muted">PayPal 계정 · 신용카드</p>
                    </div>
                  </div>
                  {PAYPAL_CLIENT_ID ? (
                    <div id="paypal-button-container" ref={handlePaypalMount} />
                  ) : (
                    <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                      NEXT_PUBLIC_PAYPAL_CLIENT_ID 설정 필요
                    </div>
                  )}
                </div>

                {/* 스트라이프 */}
                <div className="rounded-2xl border border-skin-line bg-skin-1 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF]/15">
                      <span className="text-[14px] font-extrabold text-[#635BFF]">S</span>
                    </div>
                    <div>
                      <p className="font-extrabold">스트라이프 Stripe</p>
                      <p className="text-[11px] text-muted">글로벌 카드결제</p>
                    </div>
                  </div>
                  {STRIPE_PK ? (
                    <button
                      onClick={handleStripeInit}
                      disabled={processing}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] text-[14px] font-bold text-white disabled:opacity-50"
                    >
                      {processing ? <Loader2 size={16} className="animate-spin" /> : null}
                      Stripe로 결제하기
                    </button>
                  ) : (
                    <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY (Apps Script) 설정 필요
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP: 스트라이프 결제 폼 */}
          {step === "stripe_form" && (
            <div>
              <button onClick={() => setStep("card_select")} className="mb-4 text-[13px] text-muted">← 다른 결제 방법</button>
              <div id="stripe-payment-element" ref={stripeElRef} className="mb-4" />
              <button
                onClick={handleStripeConfirm}
                disabled={processing}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#635BFF] text-[16px] font-extrabold text-white disabled:opacity-50"
              >
                {processing ? <Loader2 size={18} className="animate-spin" /> : null}
                결제하기
              </button>
            </div>
          )}

          {/* STEP: 완료 */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cuke/15">
                <BadgeCheck size={40} className="text-cuke" />
              </div>
              <p className="text-[20px] font-extrabold">결제 완료!</p>
              <p className="text-[13px] text-muted">거래가 성사됐어요. 판매자에게 픽업 일정을 문의해보세요.</p>
              <button onClick={onClose} className="mt-2 rounded-2xl bg-cuke px-8 py-3 text-[14px] font-bold text-skin-0">
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
