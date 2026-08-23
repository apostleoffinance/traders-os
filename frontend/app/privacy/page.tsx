import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export const metadata: Metadata = {
  title: "Privacy · Trader OS",
};

export default function PrivacyPage() {
  return (
    <div className="landing">
      <LandingNav />
      <article className="lp-legal">
        <p className="lp-kicker">Legal</p>
        <h1>Privacy</h1>
        <p>
          Trader OS stores the account, journal, risk and analytics data you enter so the product can compute
          performance, discipline and intelligence for your login. Trading data is isolated to your account. We do not
          sell journal contents or use them to produce trade signals for other users.
        </p>
        <p>
          Session tokens stay in your browser. If you enable reminders, a push subscription is stored so we can send
          journal prompts you requested. Contact the operator of this instance for deletion of your account and
          associated records.
        </p>
        <p>
          <Link href="/">Back to Trader OS</Link>
        </p>
      </article>
      <LandingFooter />
    </div>
  );
}
