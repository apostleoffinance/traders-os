import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import "@/components/landing/landing.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_ORIGIN || "http://localhost:3000"),
  title: "TraderOS · Trading Intelligence Workspace",
  description: "A private trading intelligence workspace for trade history, risk, market context and research.",
  openGraph: {
    title: "TraderOS · Trading Intelligence Workspace",
    description:
      "TraderOS connects trade history, risk, market context and research in one private trading intelligence workspace.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TraderOS · Trading Intelligence Workspace",
    description:
      "TraderOS connects trade history, risk, market context and research in one private trading intelligence workspace.",
  },
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("traderos-theme")||"light";var d=(t==="light"||t==="dark")?t :(t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):"light");document.documentElement.setAttribute("data-theme",d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute("data-theme","light");document.documentElement.style.colorScheme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} trader-os-fonts`}
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
