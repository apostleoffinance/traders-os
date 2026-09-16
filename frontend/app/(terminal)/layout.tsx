import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { GlobalFiltersProvider } from "@/lib/filters";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalFiltersProvider>
      <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
        <Shell>{children}</Shell>
      </Suspense>
    </GlobalFiltersProvider>
  );
}
