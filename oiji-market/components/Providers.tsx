"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#14241b",
                color: "#e9f2e8",
                border: "1px solid #22382b",
                borderRadius: "14px",
              },
            }}
          />
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
