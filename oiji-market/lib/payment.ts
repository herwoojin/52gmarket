const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  holderName: string;
}

export async function fetchBankInfo(sellerUid: string): Promise<BankInfo | null> {
  if (!APPS_SCRIPT_URL || !sellerUid) return null;
  try {
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=bankInfo&uid=${encodeURIComponent(sellerUid)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.ok ? (data.info as BankInfo | null) : null;
  } catch {
    return null;
  }
}

export async function saveBankInfo(uid: string, info: BankInfo): Promise<void> {
  if (!APPS_SCRIPT_URL) return;
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "setBankInfo", uid, info }),
  });
}

export async function notifyPaymentSent(productId: string): Promise<void> {
  if (!APPS_SCRIPT_URL) return;
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "notifyPayment", id: productId }),
  });
}

export async function confirmDeposit(productId: string): Promise<void> {
  if (!APPS_SCRIPT_URL) return;
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "confirmDeposit", id: productId }),
  });
}

export async function createStripeIntent(amount: number): Promise<string | null> {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "stripeIntent", amount }),
    });
    const data = await res.json();
    return data.ok ? (data.clientSecret as string) : null;
  } catch {
    return null;
  }
}

export function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
