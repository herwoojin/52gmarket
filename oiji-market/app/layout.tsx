import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import BottomTabWrapper from "@/components/BottomTabWrapper";

export const metadata: Metadata = {
  title: "오이(52)지마켓",
  description: "사내 전산소모품·사무용품 나눔/재판매 마켓플레이스",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "오이지마켓",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a120d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col bg-skin-0 text-ink">
        <Providers>
          {/* 헤더 */}
          <header className="sticky top-0 z-40 border-b border-skin-line bg-skin-0/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[920px] items-center gap-3 px-4" style={{ paddingTop: "max(env(safe-area-inset-top), 14px)", paddingBottom: "12px" }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cuke text-xl">
                🥒
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">
                  오이<span className="text-cuke-bright">(52)</span>지마켓
                </h1>
                <p className="text-[11.5px] text-muted">사내 나눔·재판매 마켓</p>
              </div>
            </div>
          </header>

          {/* 메인 콘텐츠 */}
          <main className="mx-auto w-full max-w-[920px] flex-1 pb-24">
            {children}
          </main>

          {/* 하단 탭 */}
          <BottomTabWrapper />
        </Providers>
      </body>
    </html>
  );
}
