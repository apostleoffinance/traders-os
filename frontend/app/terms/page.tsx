import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export const metadata: Metadata = {
  title: "Terms · Trader OS",
};

export default function TermsPage() {
  return (
    <div className="landing">
      <LandingNav />
      <article className="lp-legal">
        <p className="lp-kicker">Legal</p>
        <h1>Terms</h1>
        <p>
          Trader OS is a journal, risk-management, analytics and intelligence workspace. It is not a broker, not a
          trading terminal, not a signal service and not investment advice. You remain responsible for every decision
          you take in the market.
        </p>
        <p>
          Figures on the public landing page are labelled product examples. Live statistics in the workspace are
          computed from the trades you log. The intelligence layer interprets structured analytics; it must not be
          treated as a buy or sell instruction.
        </p>
        <p>
          <Link href="/">Back to Trader OS</Link>
        </p>
      </article>
      <LandingFooter />
    </div>
  );
}
