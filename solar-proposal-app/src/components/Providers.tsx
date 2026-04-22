"use client";

import { Toaster } from "@/components/ui/Toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
