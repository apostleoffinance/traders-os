import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import "@/components/landing/landing.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_ORIGIN || "http://localhost:3000"),
  title: "Trader OS",
  description: "Trading journal, risk and discipline intelligence",
  openGraph: {
    title: "Trader OS · Journal · Discipline · Intelligence",
    description:
      "Trader OS turns your trading history into structured data, helping you understand performance, risk, discipline and behavior over time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trader OS · Journal · Discipline · Intelligence",
    description:
      "Trader OS turns your trading history into structured data, helping you understand performance, risk, discipline and behavior over time.",
  },
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("traderos-theme")||"dark";var d=(t==="light"||t==="dark")?t:(t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"dark");document.documentElement.setAttribute("data-theme",d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${plexSans.className} ${plexSans.variable} ${plexMono.variable}`}
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
