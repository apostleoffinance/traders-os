"use client";

import Link from "next/link";
import type { RiskCommand, RiskGauge } from "@/lib/risk-command";
import { Alert, Badge, LimitBar, Panel } from "@/components/ui";
import { money, num } from "@/lib/format";

function radarTone(label: string, status: string): string {
  if (label === "HALT" || status === "red") return "halt";
  if (label === "CAUTION" || status === "yellow") return "caution";
  return "healthy";
}

function RiskRadar({ radar, status }: { radar: RiskCommand["risk_radar"]; status: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (radar.score / 100) * c;
  const tone = radarTone(radar.label, status);

  return (
    <div className="radar-wrap">
      <p className="kicker">Account risk</p>
      <div className="radar-main">
        <svg viewBox="0 0 140 140" className="radar-svg" aria-label={`Risk score ${radar.score} out of 100`}>
          <circle cx="70" cy="70" r={r} className="ring-bg" />
          <circle
            cx="70"
            cy="70"
            r={r}
            className={`ring-fill ${tone}`}
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="radar-center">
          <span className={`status-dot ${tone}`} />
          <div className={`score num ${tone}`}>{radar.score}</div>
          <div className="label">{radar.label}</div>
        </div>
      </div>
      <div className="radar-gauges">
        <GaugeBar title="Daily loss" gauge={radar.gauges.daily_loss} format="money" />
        <GaugeBar title="Drawdown" gauge={radar.gauges.drawdown} format="money" />
        <GaugeBar
          title="Trades today"
          gauge={radar.gauges.trades_today}
          format="count"
        />
      </div>
      <style jsx>{`
        .radar-wrap {
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .kicker {
          margin: 0 0 12px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .radar-main {
          position: relative;
          width: 160px;
          margin: 0 auto 16px;
        }
        .radar-svg {
          display: block;
          width: 160px;
          height: 160px;
        }
        .ring-bg {
          fill: none;
          stroke: var(--line);
          stroke-width: 10;
        }
        .ring-fill {
          fill: none;
          stroke-width: 10;
          stroke-linecap: round;
        }
        .ring-fill.healthy {
          stroke: var(--success);
        }
        .ring-fill.caution {
          stroke: var(--warning);
        }
        .ring-fill.halt {
          stroke: var(--danger);
        }
        .radar-center {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 2px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-bottom: 2px;
        }
        .status-dot.healthy {
          background: var(--success);
        }
        .status-dot.caution {
          background: var(--warning);
        }
        .status-dot.halt {
          background: var(--danger);
        }
        .score {
          font-size: 36px;
          font-weight: 700;
          line-height: 1;
        }
        .score.healthy {
          color: var(--success);
        }
        .score.caution {
          color: var(--warning);
        }
        .score.halt {
          color: var(--danger);
        }
        .label {
          font-size: 11px;
          letter-spacing: 0.12em;
          font-weight: 700;
          color: var(--text-secondary);
        }
        .radar-gauges {
          display: grid;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}

function GaugeBar({
  title,
  gauge,
  format,
}: {
  title: string;
  gauge: RiskGauge | RiskCommand["risk_radar"]["gauges"]["trades_today"];
  format: "money" | "count";
}) {
  const usedLabel =
    format === "money"
      ? `${money(gauge.used)} / ${money(gauge.limit)}`
      : `${gauge.used} / ${gauge.limit}`;
  const remainLabel =
    format === "money" ? money(gauge.remaining) : gauge.remaining;
  let tone = "";
  if (gauge.used_pct >= 100) tone = "neg";
  else if (gauge.used_pct >= 70) tone = "warn";

  return (
    <div className="gauge">
      <div className="row">
        <span>{title}</span>
        <span className={`num ${tone}`}>{usedLabel}</span>
      </div>
      <div className="track">
        <div className={`fill ${tone}`} style={{ width: `${gauge.used_pct}%` }} />
      </div>
      <span className="remain">{remainLabel} remaining</span>
      <style jsx>{`
        .gauge {
          display: grid;
          gap: 5px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
        }
        .track {
          height: 5px;
          background: var(--surface-2);
          border-radius: 2px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: var(--success);
        }
        .fill.warn {
          background: var(--warning);
        }
        .fill.neg {
          background: var(--danger);
        }
        .remain {
          font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

function TradingCapacity({ data }: { data: RiskCommand["trading_capacity"] }) {
  return (
    <div className="capacity">
      <p className="kicker">Trading capacity</p>
      <p className="lead">You can afford</p>
      <div className="nums">
        <div>
          <strong className="num">{data.full_risk_trades_remaining}</strong>
          <span>full-risk trades</span>
        </div>
        <span className="or">or</span>
        <div>
          <strong className="num">{data.half_risk_trades_remaining}</strong>
          <span>half-risk trades</span>
        </div>
      </div>
      <p className="muted">
        At ${data.risk_per_trade} risk per trade · daily loss {money(data.daily_loss_used)} /{" "}
        {money(data.daily_loss_limit)} used
      </p>
      <div className="cap-bar">
        <div className="fill" style={{ width: `${Math.min(100, data.daily_loss_used_pct)}%` }} />
      </div>
      <style jsx>{`
        .capacity {
          padding: 16px 18px;
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .kicker {
          margin: 0 0 8px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .lead {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .nums {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin: 8px 0 10px;
          flex-wrap: wrap;
        }
        .nums strong {
          font-size: 28px;
          color: var(--accent);
          margin-right: 6px;
        }
        .nums span {
          font-size: 14px;
        }
        .or {
          color: var(--text-secondary);
          font-size: 13px;
        }
        .muted {
          margin: 0 0 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .cap-bar {
          height: 5px;
          background: var(--surface-2);
          border-radius: 2px;
          overflow: hidden;
        }
        .cap-bar .fill {
          height: 100%;
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}

function SurvivalMode({ data }: { data: RiskCommand["survival_mode"] }) {
  return (
    <div className="survival">
      <div className="survival-head">
        <div>
          <p className="kicker">🛡 Survival mode</p>
          <h2>{data.firm}</h2>
          <p className="muted">
            {data.program} · {data.phase} · {money(data.equity, data.currency)} equity
          </p>
        </div>
        <Link href="/accounts" className="link">
          Edit rules
        </Link>
      </div>
      <div className="survival-grid">
        {data.profit_target && (
          <SurvivalGauge
            title="Profit target"
            gauge={data.profit_target}
            currency={data.currency}
            positive
          />
        )}
        <SurvivalGauge title="Max daily loss" gauge={data.max_daily_loss} currency={data.currency} />
        <SurvivalGauge title="Max drawdown" gauge={data.max_drawdown} currency={data.currency} />
      </div>
      <style jsx>{`
        .survival {
          padding: 16px 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .survival-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }
        .kicker {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        h2 {
          margin: 0;
          font-size: 20px;
        }
        .muted {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .survival-grid {
          display: grid;
          gap: 14px;
        }
      `}</style>
    </div>
  );
}

function SurvivalGauge({
  title,
  gauge,
  currency,
  positive,
}: {
  title: string;
  gauge: RiskGauge;
  currency: string;
  positive?: boolean;
}) {
  const tone = positive
    ? gauge.used_pct >= 100
      ? "ok"
      : ""
    : gauge.used_pct >= 100
      ? "neg"
      : gauge.used_pct >= 70
        ? "warn"
        : "";

  return (
    <div className="sg">
      <div className="sg-head">
        <span>{title}</span>
        <span className="num">{money(gauge.limit, currency)}</span>
      </div>
      <div className="track">
        <div className={`fill ${tone}`} style={{ width: `${gauge.used_pct}%` }} />
      </div>
      <span className="remain">
        {money(gauge.remaining, currency)} remaining · {money(gauge.used, currency)} used
      </span>
      <style jsx>{`
        .sg-head {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 600;
        }
        .track {
          height: 6px;
          background: var(--surface-2);
          border-radius: 2px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: var(--accent);
        }
        .fill.ok {
          background: var(--success);
        }
        .fill.warn {
          background: var(--warning);
        }
        .fill.neg {
          background: var(--danger);
        }
        .remain {
          display: block;
          margin-top: 5px;
          font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

export function RiskCommandView({ data }: { data: RiskCommand }) {
  const m = data.metrics;
  const alertKind = data.status === "red" ? "danger" : data.status === "yellow" ? "warn" : "info";

  return (
    <div className="rc">
      <div className="head">
        <div>
          <p className="page-kicker">Risk Command</p>
          <h1>Protect capital</h1>
          <p className="muted">
            Personal limits are stricter than firm limits. Green means safety — not permission to size up after
            losses.
          </p>
        </div>
        <div className="head-right">
          <Badge status={data.status} />
        </div>
      </div>

      {data.reasons.map((r) => (
        <Alert key={r} kind={alertKind}>
          {r}
        </Alert>
      ))}

      <TradingCapacity data={data.trading_capacity} />

      <div className="hero-grid">
        <RiskRadar radar={data.risk_radar} status={data.status} />
        <SurvivalMode data={data.survival_mode} />
      </div>

      <div className="mid-grid">
        <Panel title="Personal limits">
          <LimitBar
            label="Daily loss"
            limit={data.limits.personal_daily_loss.limit}
            remaining={data.limits.personal_daily_loss.remaining}
          />
          <LimitBar
            label="Max drawdown"
            limit={data.limits.personal_max_drawdown.limit}
            remaining={data.limits.personal_max_drawdown.remaining}
          />
        </Panel>
        <Panel title="Behaviour signals">
          <div className="signals">
            <div>
              <span className="lbl">Daily P/L</span>
              <span className={`num ${Number(m.daily_pnl) < 0 ? "neg" : Number(m.daily_pnl) > 0 ? "pos" : ""}`}>
                {money(m.daily_pnl, data.account.currency)}
              </span>
            </div>
            <div>
              <span className="lbl">Consecutive losses</span>
              <span className={`num ${m.consecutive_losses >= 3 ? "warn" : ""}`}>{m.consecutive_losses}</span>
            </div>
            <div>
              <span className="lbl">Risk escalation</span>
              <span className={`num ${m.risk_escalation_pct && Number(m.risk_escalation_pct) > 0 ? "warn" : ""}`}>
                {m.risk_escalation_pct ? `${num(Number(m.risk_escalation_pct) * 100, 0)}%` : "—"}
              </span>
            </div>
            <div>
              <span className="lbl">Avg risk (last N)</span>
              <span className="num">{m.avg_risk_last_n ? money(m.avg_risk_last_n, data.account.currency) : "—"}</span>
            </div>
          </div>
        </Panel>
      </div>

      {data.events.length > 0 && (
        <Panel title="Risk events">
          <ul className="events">
            {data.events.map((e, i) => (
              <li key={`${e.event_type}-${i}`}>
                <Badge status={e.severity} /> {e.message}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <style jsx>{`
        .rc {
          display: grid;
          gap: 14px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .head-right {
          display: grid;
          justify-items: end;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 14px;
          align-items: start;
        }
        .mid-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .signals {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .signals div {
          display: grid;
          gap: 4px;
        }
        .lbl {
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .events {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        :global(.num.pos) {
          color: var(--success);
        }
        :global(.num.neg) {
          color: var(--danger);
        }
        :global(.num.warn) {
          color: var(--warning);
        }
        @media (max-width: 900px) {
          .hero-grid,
          .mid-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
