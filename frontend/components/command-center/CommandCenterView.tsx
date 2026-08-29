"use client";

import Link from "next/link";
import type { Dashboard } from "@/lib/types";
import { Badge, LimitBar, Panel } from "@/components/ui";
import { EquitySparkline } from "@/components/EquitySparkline";
import { money, num, sessionLabel, signed, tone } from "@/lib/format";

type Props = {
  data: Dashboard;
  openTrades: { id: string; symbol: string; direction: string; session: string; entry_price: string; risk_amount: string }[];
};

function statusTone(status: string): string {
  if (status === "STABLE") return "stable";
  if (status === "CAUTION") return "caution";
  return "halt";
}

export function CommandCenterView({ data, openTrades }: Props) {
  const cc = data.command_center;
  const pnlPct =
    Number(data.starting_balance) > 0
      ? (Number(data.total_pnl) / Number(data.starting_balance)) * 100
      : null;

  return (
    <div className="cc">
      <section className="hero-grid">
        <div className="hero-main">
          <div className="hero-top">
            <span className="kicker">Account status</span>
            <span className={`status-pill ${statusTone(cc.account_status)}`}>{cc.account_status}</span>
          </div>
          <div className={`hero-equity num ${tone(data.total_pnl)}`}>{money(data.equity)}</div>
          <p className="hero-sub muted">Equity · {data.account.currency}</p>
          <div className="hero-metrics">
            <span className={`num ${tone(data.daily_pnl)}`}>{signed(data.daily_pnl)} today</span>
            {pnlPct != null && (
              <span className={`num ${tone(data.total_pnl)}`}>
                {pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(1)}% all time
              </span>
            )}
            {!data.health || data.health.status === "insufficient_data" ? (
              <span className="muted">Health unlocks at {data.health?.trades_needed ?? 30} trades</span>
            ) : (
              <span>Trading health {data.health.score}/100</span>
            )}
          </div>
          <EquitySparkline series={data.equity_series ?? []} height={72} />
        </div>

        <div className="hero-side">
          <div className="capacity-block">
            <span className="kicker">Trading capacity</span>
            <p className="capacity-line">
              <strong>{cc.trading_capacity.full_risk_trades_remaining}</strong> full-risk trades
            </p>
            <p className="muted small">
              or <strong>{cc.trading_capacity.half_risk_trades_remaining}</strong> at half risk remaining today
            </p>
            <div className="capacity-bar">
              <div
                className="fill"
                style={{ width: `${Math.min(100, cc.trading_capacity.daily_loss_used_pct)}%` }}
              />
            </div>
            <p className="muted small">
              Daily loss {money(cc.trading_capacity.daily_loss_used)} /{" "}
              {money(cc.trading_capacity.daily_loss_limit)} used
            </p>
          </div>
          <LimitBar
            label="Personal daily loss"
            limit={data.personal_daily_loss.limit}
            remaining={data.personal_daily_loss.remaining}
          />
          <LimitBar
            label="Max drawdown room"
            limit={data.personal_max_dd.limit}
            remaining={data.personal_max_dd.remaining}
          />
          <div className="risk-row">
            <Badge status={data.risk_status} />
            <span className="muted small">{data.trades_today} / {data.max_trades_per_day} trades today</span>
          </div>
        </div>
      </section>

      {data.risk_reasons.slice(0, 2).map((r) => (
        <div key={r} className={`banner ${data.risk_status}`}>
          {r}
        </div>
      ))}

      <div className="mid-grid">
        <Panel title="Today's story">
          <p className="story-head">{cc.today_story.headline}</p>
          {cc.today_story.discipline_avg != null && (
            <p className="disc-score">
              Discipline <strong>{cc.today_story.discipline_avg}</strong>/100 today
            </p>
          )}
          <ul className="bullets">
            {cc.today_story.bullets.map((b, i) => (
              <li key={i} className={b.tone}>
                {b.text}
              </li>
            ))}
            {cc.today_story.bullets.length === 0 && cc.today_story.trade_count === 0 && (
              <li className="muted">Your day replay will appear when you log or sync trades.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Today's timeline">
          {cc.timeline.length === 0 ? (
            <p className="muted">No activity logged today.</p>
          ) : (
            <ol className="timeline">
              {cc.timeline.map((ev, i) => (
                <li key={`${ev.trade_id}-${ev.type}-${i}`}>
                  <Link href={`/trades/${ev.trade_id}`} className="tl-link">
                    <time>{new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    <span className="tl-label">{ev.label}</span>
                    <span className={`tl-detail ${ev.severity}`}>{ev.detail}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mid-grid">
        <Panel title="Active positions">
          {openTrades.length === 0 ? (
            <p className="muted">No open trades.</p>
          ) : (
            <ul className="positions">
              {openTrades.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>
                      {t.symbol} {t.direction.toUpperCase()}
                    </strong>
                    <span className="muted small">
                      {sessionLabel(t.session)} · entry {t.entry_price} · risk {money(t.risk_amount)}
                    </span>
                  </div>
                  <Link href={`/trades/${t.id}`}>View</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your edge right now">
          {cc.edge_snapshot ? (
            <>
              <p className="edge-label">{cc.edge_snapshot.label}</p>
              <p className="muted small">{cc.edge_snapshot.kind} · n={cc.edge_snapshot.n}</p>
              <div className="edge-stats">
                <span>{cc.edge_snapshot.expectancy_r}R expectancy</span>
                {cc.edge_snapshot.win_rate && <span>{num(Number(cc.edge_snapshot.win_rate), 1)}% win rate</span>}
              </div>
              <p className="muted small">{cc.edge_snapshot.evidence?.label} evidence — {cc.edge_snapshot.evidence?.reason}</p>
              <Link href="/analytics?tab=edge" className="link">
                Explore in Analytics Lab →
              </Link>
            </>
          ) : (
            <p className="muted">Log more closed trades to surface your strongest session or setup.</p>
          )}
        </Panel>
      </div>

      <div className="mid-grid">
        <Panel title="Behaviour watch">
          {cc.behaviour_watch ? (
            <>
              <p className="watch-title">{cc.behaviour_watch.title}</p>
              <p>{cc.behaviour_watch.summary}</p>
              {cc.behaviour_watch.evidence && (
                <p className="muted small">
                  {cc.behaviour_watch.evidence.label} · n={cc.behaviour_watch.evidence.n}
                </p>
              )}
              <Link href="/intelligence" className="link">
                View full feed →
              </Link>
            </>
          ) : (
            <p className="muted">No behaviour flags right now. Keep following your process.</p>
          )}
        </Panel>

        <Panel title="Latest insights">
          {cc.insights.length === 0 ? (
            <p className="muted">Insights appear as your journal grows.</p>
          ) : (
            <ul className="insights">
              {cc.insights.map((ins, i) => (
                <li key={i} className={ins.severity}>
                  <span className="ins-type">{ins.type}</span>
                  <strong>{ins.title}</strong>
                  <p className="muted small">{ins.summary}</p>
                  {ins.evidence && (
                    <p className="evidence">
                      Why: {ins.evidence.reason} (n={ins.evidence.n}, {ins.evidence.label})
                    </p>
                  )}
                  <Link href="/intelligence" className="link small">
                    View evidence →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="kpi-strip">
        <div>
          <span className="kicker">Win rate</span>
          <span className="num">{data.win_rate ? `${num(data.win_rate, 1)}%` : "—"}</span>
        </div>
        <div>
          <span className="kicker">Expectancy</span>
          <span className="num">{data.expectancy_r ? `${num(data.expectancy_r)}R` : "—"}</span>
        </div>
        <div>
          <span className="kicker">Profit factor</span>
          <span className="num">{data.profit_factor ? num(data.profit_factor) : "—"}</span>
        </div>
        <div>
          <span className="kicker">Discipline</span>
          <span className="num">{data.discipline_score ?? "—"}</span>
        </div>
        <div>
          <span className="kicker">Trades</span>
          <span className="num">{data.n_trades}</span>
        </div>
      </div>

      <style jsx>{`
        .cc {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 16px;
        }
        .hero-main,
        .hero-side {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 18px 20px;
          background: var(--surface);
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .kicker {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .status-pill {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--line-strong);
        }
        .status-pill.stable {
          color: var(--accent);
          border-color: var(--accent);
        }
        .status-pill.caution {
          color: var(--warning);
          border-color: var(--warning);
        }
        .status-pill.halt {
          color: var(--danger);
          border-color: var(--danger);
        }
        .hero-equity {
          font-size: 42px;
          font-weight: 700;
          line-height: 1.1;
          margin: 4px 0;
        }
        .hero-sub {
          margin: 0 0 12px;
          font-size: 14px;
        }
        .hero-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 14px;
          font-size: 15px;
        }
        .capacity-block {
          margin-bottom: 14px;
        }
        .capacity-line {
          margin: 6px 0 2px;
          font-size: 18px;
        }
        .capacity-bar {
          height: 6px;
          background: var(--surface-2);
          border-radius: 3px;
          margin: 10px 0 6px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
        }
        .small {
          font-size: 13px;
        }
        .risk-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        .banner {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          border: 1px solid var(--line);
        }
        .banner.red {
          border-color: var(--danger);
          background: color-mix(in srgb, var(--danger) 10%, transparent);
        }
        .banner.yellow {
          border-color: var(--warning);
          background: color-mix(in srgb, var(--warning) 10%, transparent);
        }
        .mid-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .story-head {
          font-size: 17px;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .disc-score {
          margin: 0 0 10px;
        }
        .bullets {
          margin: 0;
          padding-left: 1.2rem;
          line-height: 1.6;
        }
        .bullets .positive {
          color: var(--accent);
        }
        .bullets .warn {
          color: var(--warning);
        }
        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
          border-left: 2px solid var(--line);
        }
        .timeline li {
          margin-left: 12px;
          padding: 0 0 12px 12px;
          position: relative;
        }
        .timeline li::before {
          content: "";
          position: absolute;
          left: -17px;
          top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
        }
        .tl-link {
          display: grid;
          gap: 2px;
          color: inherit;
          text-decoration: none;
        }
        .tl-link:hover .tl-label {
          color: var(--accent);
        }
        time {
          font-size: 12px;
          color: var(--muted);
          font-family: var(--font-mono), monospace;
        }
        .tl-detail.warn {
          color: var(--warning);
        }
        .tl-detail.success {
          color: var(--accent);
        }
        .positions {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .positions li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--line);
        }
        .positions li:last-child {
          border-bottom: 0;
        }
        .edge-label {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }
        .edge-stats {
          display: flex;
          gap: 16px;
          margin: 10px 0;
          font-family: var(--font-mono), monospace;
        }
        .link {
          display: inline-block;
          margin-top: 8px;
          color: var(--accent);
          font-size: 14px;
        }
        .watch-title {
          font-weight: 600;
          margin: 0 0 6px;
        }
        .insights {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .ins-type {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--muted);
          display: block;
        }
        .evidence {
          font-size: 12px;
          color: var(--muted);
          margin: 4px 0 0;
        }
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid var(--line);
        }
        .kpi-strip .num {
          display: block;
          font-size: 20px;
          font-weight: 700;
          margin-top: 4px;
        }
        @media (max-width: 900px) {
          .hero-grid,
          .mid-grid,
          .kpi-strip {
            grid-template-columns: 1fr;
          }
          .kpi-strip {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
