import { Shell } from "@/components/Shell";
import { GlobalFiltersProvider } from "@/lib/filters";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalFiltersProvider>
      <Shell>{children}</Shell>
    </GlobalFiltersProvider>
  );
}
