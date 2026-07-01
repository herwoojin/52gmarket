import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
