"use client";

import Link from "next/link";
import { Badge, LimitBar, Panel } from "@/components/ui";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { HeroBackdrop } from "./HeroBackdrop";
import { HeroCanvas } from "./HeroCanvas";
import { HeroPreview } from "./HeroPreview";
import { WorkspacePreview } from "./WorkspacePreview";
import { TelegramMark, YouTubeMark } from "@/components/SocialMarks";
import { COMMUNITY } from "@/lib/community";
import { FEATURE_HIGHLIGHTS, SAMPLE_EVIDENCE, SAMPLE_LABEL, SAMPLE_LIMITS } from "./sample";
import { primaryHref, primaryLabel, useSignedIn } from "./useSignedIn";

const FLOW = ["Sync", "Journal", "Analyze", "Risk", "Improve"] as const;

export function LandingPage() {
  const signedIn = useSignedIn();
  const href = primaryHref(signedIn);
  const label = primaryLabel(signedIn);

  return (
    <div className="landing">
      <a className="sr-only" href="#product">
        Skip to product
      </a>
      <LandingNav />

      <section className="lp-hero">
        <HeroBackdrop />
        <HeroCanvas />
        <div className="lp-hero-inner">
          <div>
            <p className="lp-wordmark">Trader OS</p>
            <p className="lp-hero-tag">Journal · Discipline · Intelligence</p>
            <h1>
              Your trading.
              <br />
              Understood deeply.
            </h1>
            <p className="lp-lede">
              Command Center, Analytics Lab, Quant Lab, and Intelligence Feed — one terminal for performance, risk,
              discipline, and behaviour. Built on your journal, not market noise.
            </p>
            <div className="lp-hero-actions">
              <Link href={href} className="lp-cta">
                {label}
              </Link>
              <a href="#features" className="lp-cta ghost">
                See feature highlights
              </a>
            </div>
            <p className="lp-aside">No signals. No noise. Just your data.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="lp-section" id="product">
        <p className="lp-section-label">Product</p>
        <h2>Every trade tells a story.</h2>
        <p className="lp-copy">
          P/L is a result. Trader OS captures the trade, the setup, the execution, the risk and the reasoning — then
          surfaces what repeats across Command Center, Analytics Lab, and Intelligence Feed.
        </p>
        <div className="lp-concepts">
          <article className="lp-concept">
            <h3>Journal</h3>
            <p>Log manually or sync from MT5. Setup, risk, checklist, psychology, and outcome in one place.</p>
          </article>
          <article className="lp-concept">
            <h3>Discipline</h3>
            <p>Score whether you followed your process — independent of whether the trade won or lost.</p>
          </article>
          <article className="lp-concept">
            <h3>Intelligence</h3>
            <p>Deterministic insights and sample-aware evidence about edge, behaviour, and risk after losses.</p>
          </article>
        </div>
      </section>

      <section className="lp-section" id="features">
        <p className="lp-section-label">Feature highlights</p>
        <h2>Built for serious process work.</h2>
        <p className="lp-copy">
          Sync, analyze, stress-test your edge, and interpret patterns — without turning Trader OS into a signal feed.
        </p>
        <div className="lp-features">
          {FEATURE_HIGHLIGHTS.map((f) => (
            <article key={f.title} className="lp-feature">
              <p className="lp-feature-kicker">{f.subtitle}</p>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-kicker">{SAMPLE_LABEL}</p>
        <h2>Stop judging yourself by the last trade.</h2>
        <p className="lp-copy">
          Analytics Lab looks across your history: expectancy, sessions, streaks, profit factor, and where risk changes
          after a loss. Short windows stay honest when the sample is thin.
        </p>
        <div className="lp-metrics">
          {SAMPLE_EVIDENCE.map((m) => (
            <div key={m.label}>
              <div className={`lp-metric-value num ${m.tone}`}>{m.value}</div>
              <div className="lp-metric-label">
                {m.label}
                {m.hint ? ` · ${m.hint}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="risk">
        <div className="lp-split">
          <div>
            <p className="lp-section-label">Risk Command</p>
            <h2>Know when you&apos;re going too hard.</h2>
            <p className="lp-copy">
              Risk Command monitors daily risk, maximum drawdown, consecutive losses, risk escalation, firm and personal
              limits. It does not push you to trade more — it flags when behaviour is becoming dangerous.
            </p>
          </div>
          <div className="lp-risk-card">
            <p className="lp-example">{SAMPLE_LABEL} · Risk Command</p>
            <Panel title="Limits" right={<Badge status="green" />}>
              <LimitBar label={SAMPLE_LIMITS[0].label} limit={SAMPLE_LIMITS[0].limit} remaining={SAMPLE_LIMITS[0].remaining} />
              <LimitBar label={SAMPLE_LIMITS[1].label} limit={SAMPLE_LIMITS[1].limit} remaining={SAMPLE_LIMITS[1].remaining} />
            </Panel>
            <p className="lp-note">Consecutive losses, escalation after a loss, and halt states live in the same view.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" id="intelligence">
        <div className="lp-split">
          <div>
            <p className="lp-section-label">Intelligence Feed</p>
            <h2>Your history becomes your edge.</h2>
            <p className="lp-copy">
              Intelligence Feed surfaces deterministic findings with evidence and sample size. Optional AI coaching
              interprets those same stats — it never invents numbers or tells you what to buy or sell.
            </p>
          </div>
          <div className="lp-finding-card">
            <p className="lp-example">{SAMPLE_LABEL} · Finding</p>
            <p className="lp-finding">
              Your data shows that your worst-performing trades tend to occur when you increase risk after a loss.
            </p>
            <dl className="lp-dl">
              <div>
                <dt>Evidence</dt>
                <dd className="num pos">+0.31R vs −0.22R</dd>
              </div>
              <div>
                <dt>Pattern</dt>
                <dd>Risk after loss</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>High</dd>
              </div>
              <div>
                <dt>Historical sample</dt>
                <dd className="num">47 trades</dd>
              </div>
            </dl>
            <p className="muted lp-tiny">Deterministic analytics first. Interpretation second.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" id="workspace">
        <p className="lp-section-label">Workspace</p>
        <h2>This is what you get when you enter Trader OS.</h2>
        <p className="lp-copy">
          Command Center, Analytics Lab, Quant Lab, Reports, Intelligence Feed, Risk Command, Calculator, and Market
          Pulse. One visual language. Figures below are labelled product examples, not live account data.
        </p>
        <WorkspacePreview />
      </section>

      <section className="lp-section" id="how-it-works">
        <p className="lp-section-label">How it works</p>
        <h2>Built around your process.</h2>
        <p className="lp-copy">
          Trade on MetaTrader or your broker. Sync with TraderOSSync or journal by hand. Size with the calculator. Review
          in Analytics Lab and Quant Lab. Trader OS is not a charting replacement and not a place to hunt for the next
          trade.
        </p>
        <div className="lp-flow" aria-label="Process">
          {FLOW.map((step, i) => (
            <span key={step} style={{ display: "contents" }}>
              {i > 0 && (
                <span className="lp-arrow" aria-hidden>
                  →
                </span>
              )}
              <span className="lp-step">{step}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="lp-section" id="community">
        <p className="lp-section-label">Community</p>
        <h2>Stay close to the process.</h2>
        <p className="lp-copy">
          Journal in Trader OS. Talk through the work in the community. No signals. No trade calls.
        </p>
        <div className="lp-community">
          <a className="lp-community-card" href={COMMUNITY.telegram.href} target="_blank" rel="noreferrer">
            <TelegramMark size={22} />
            <strong>Telegram</strong>
          </a>
          <a className="lp-community-card" href={COMMUNITY.youtube.href} target="_blank" rel="noreferrer">
            <YouTubeMark size={22} />
            <strong>YouTube</strong>
          </a>
        </div>
      </section>

      <section className="lp-final">
        <img className="lp-final-logo" src="/brand/logo.png" alt="Trader OS" width={960} height={640} />
        <h2>
          Trade less emotionally.
          <br />
          Understand yourself more objectively.
        </h2>
        <Link href={href} className="lp-cta large">
          {label}
        </Link>
      </section>

      <LandingFooter />
    </div>
  );
}
