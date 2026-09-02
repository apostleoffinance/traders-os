import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { COMMUNITY } from "@/lib/community";
import { TelegramMark, YouTubeMark } from "@/components/SocialMarks";

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-brand">
          <BrandMark size={28} />
          <div>
            <div className="lp-brand-name">Trader OS</div>
            <p className="lp-brand-tag">Journal · Discipline · Intelligence</p>
          </div>
        </div>
        <nav aria-label="Footer">
          <Link href="/#product">Product</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#workspace">Workspace</Link>
          <Link href="/#community">Community</Link>
          <a href={COMMUNITY.telegram.href} target="_blank" rel="noreferrer" className="lp-social">
            <TelegramMark size={16} />
            Telegram
          </a>
          <a href={COMMUNITY.youtube.href} target="_blank" rel="noreferrer" className="lp-social">
            <YouTubeMark size={16} />
            YouTube
          </a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Login</Link>
        </nav>
      </div>
    </footer>
  );
}
