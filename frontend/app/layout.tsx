import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_ORIGIN || "http://localhost:3000"),
  title: "Trader OS",
  description: "Trading journal, risk and discipline intelligence",
  openGraph: {
    title: "TraderOS · Trading Intelligence Workspace",
    description:
      "TraderOS connects trade history, risk, market context and research in one private trading intelligence workspace.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trader OS · Journal · Discipline · Intelligence",
    description:
      "Trader OS turns your trading history into structured data, helping you understand performance, risk, discipline and behavior over time.",
  },
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("traderos-theme")||"light";var d=(t==="light"||t==="dark")?t :(t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"light");document.documentElement.setAttribute("data-theme",d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute("data-theme","light");document.documentElement.style.colorScheme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className="trader-os-fonts"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
