"use client";

import { Panel, Stat } from "@/components/ui";
import { Empty, EvidenceTag } from "@/components/analytics/Charts";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money, num, signed } from "@/lib/format";

export type IntelligenceLab = NonNullable<NonNullable<AnalyticsDashboard["lab"]>["intelligence"]>;

export function IntelligenceOverview({ intel }: { intel: IntelligenceLab }) {
  const insights = intel.insights ?? [];
  const meta = intel.metadata;
  return (
    <Panel title="Your Trading Intelligence" right={<EvidenceTag label={meta.confidence.confidence_level} n={meta.sample_size} />}>
      <p className="muted">
        {meta.trades_analyzed} trades analyzed · {meta.confidence.message}
      </p>
      {insights.length === 0 ? (
        <Empty>Not enough data yet for key findings. Keep journaling closed trades.</Empty>
      ) : (
        <div className="cards">
          {insights.slice(0, 5).map((ins) => (
            <article key={ins.id} className={`card ${ins.severity}`}>
              <p className="cat">{ins.category}</p>
              <h3>{ins.title}</h3>
              <p className="finding">{ins.finding}</p>
              <p className="meta">n={ins.sample_size} · {ins.confidence}</p>
            </article>
          ))}
        </div>
      )}
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin-bottom: 12px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .card {
          border: 1px solid var(--line);
          padding: 12px;
          border-radius: 4px;
        }
        .card.warning {
          border-left: 3px solid var(--neg, #c74);
        }
        .card.opportunity {
          border-left: 3px solid var(--pos, #2a8);
        }
        .cat {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 4px;
        }
        h3 {
          font-size: 14px;
          margin: 0 0 6px;
        }
        .finding {
          font-size: 13px;
          margin: 0;
        }
        .meta {
          font-size: 11px;
          color: var(--muted);
          margin-top: 8px;
        }
      `}</style>
    </Panel>
  );
}

export function BehaviourIntelligenceLab({ intel }: { intel: IntelligenceLab }) {
  const b = intel.behaviour;
  const revenge = b.revenge_trading;
  return (
    <>
      <Panel title="Risk after wins & losses">
        <div className="stats">
          <Stat label="Baseline risk" value={revenge.baseline_risk ?? "—"} />
          <Stat label="After loss" value={revenge.average_risk_after_loss ?? "—"} />
          <Stat label="After win" value={revenge.average_risk_after_win ?? "—"} />
          <Stat label="Δ after loss" value={revenge.risk_multiplier_after_loss_pct ? `${signed(revenge.risk_multiplier_after_loss_pct)}%` : "—"} />
        </div>
        <p className="muted">{revenge.disclaimer}</p>
      </Panel>
      <Panel title="Loss streak behaviour">
        <table className="tbl">
          <thead>
            <tr>
              <th>State</th>
              <th>n</th>
              <th>Win %</th>
              <th>Avg R</th>
              <th>Avg risk</th>
            </tr>
          </thead>
          <tbody>
            {b.loss_streak_behaviour.states.map((s) => (
              <tr key={s.state}>
                <td>{s.state}</td>
                <td>{s.n}</td>
                <td>{s.win_rate ? `${num(s.win_rate, 1)}%` : "—"}</td>
                <td>{s.average_r ? `${num(s.average_r)}R` : "—"}</td>
                <td>{s.avg_risk ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Overtrading detector">
        <div className="stats">
          <Stat label="Normal trades/day" value={b.overtrading.normal_trades_per_day ?? "—"} />
          <Stat label="Max in a day" value={String(b.overtrading.max_trades_in_day)} />
          <Stat label="Status" value={b.overtrading.status} />
        </div>
      </Panel>
      <style jsx>{`
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        .tbl {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .tbl th,
        .tbl td {
          border: 1px solid var(--line);
          padding: 6px 8px;
        }
        .muted {
          font-size: 13px;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
}

export function PlaybookLab({ intel }: { intel: IntelligenceLab }) {
  const pbs = intel.playbooks.playbooks;
  if (!pbs.length) return <Panel title="Playbook Lab"><Empty>No playbook data — tag trades with setups.</Empty></Panel>;
  return (
    <Panel title="Playbook Lab">
      <div className="grid">
        {pbs.map((p) => (
          <article key={p.name} className="card">
            <h3>{p.name}</h3>
            <p className="score">Edge quality {p.edge_quality.score}</p>
            <p>n={p.trade_count} · {p.expectancy_r ? `${p.expectancy_r}R` : "—"} exp · WR {p.win_rate ? `${num(p.win_rate, 1)}%` : "—"}</p>
            <p className="drift">Recent: {p.drift.last_20?.status ?? "—"}</p>
            <p className="muted">{p.confidence.message}</p>
          </article>
        ))}
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .card {
          border: 1px solid var(--line);
          padding: 12px;
        }
        h3 {
          margin: 0 0 6px;
          font-size: 14px;
        }
        .score {
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
        }
        .drift,
        .muted {
          font-size: 12px;
          color: var(--muted);
        }
      `}</style>
    </Panel>
  );
}

export function DecisionQualityMatrix({ intel }: { intel: IntelligenceLab }) {
  const dq = intel.decision_quality;
  const labels = dq.labels;
  return (
    <Panel title="Process vs Outcome" right={<EvidenceTag n={dq.sample_size} />}>
      <p className="muted">{dq.methodology}</p>
      <div className="matrix">
        <div />
        <div className="head">Win</div>
        <div className="head">Loss</div>
        <div className="head">Good process</div>
        <div className="cell good">{labels.good_win}<br /><strong>{dq.counts.good_win}</strong></div>
        <div className="cell good">{labels.good_loss}<br /><strong>{dq.counts.good_loss}</strong></div>
        <div className="head">Poor process</div>
        <div className="cell warn">{labels.lucky_win}<br /><strong>{dq.counts.lucky_win}</strong></div>
        <div className="cell warn">{labels.bad_loss}<br /><strong>{dq.counts.bad_loss}</strong></div>
      </div>
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin-bottom: 12px;
        }
        .matrix {
          display: grid;
          grid-template-columns: 120px 1fr 1fr;
          gap: 8px;
          max-width: 480px;
        }
        .head {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
        }
        .cell {
          border: 1px solid var(--line);
          padding: 16px;
          text-align: center;
          font-size: 12px;
        }
        .cell.good {
          background: rgba(42, 136, 100, 0.08);
        }
        .cell.warn {
          background: rgba(199, 68, 68, 0.08);
        }
      `}</style>
    </Panel>
  );
}

export function ChecklistItemPanel({ intel }: { intel: IntelligenceLab }) {
  const discipline = intel.discipline as {
    checklist_impact?: {
      items?: {
        label: string;
        category: string;
        required: boolean;
        checked: { n: number; expectancy_r: string | null; win_rate: string | null };
        unchecked: { n: number; expectancy_r: string | null; win_rate: string | null };
        disclaimer: string;
      }[];
    };
  };
  const items = discipline.checklist_impact?.items ?? [];
  if (!items.length) {
    return (
      <Panel title="Checklist item impact">
        <Empty>Not enough trades with checklist responses for item-level analysis.</Empty>
      </Panel>
    );
  }
  return (
    <Panel title="Checklist item impact">
      <p className="muted">Association in your historical sample — not causation.</p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Item</th>
            <th>Checked n</th>
            <th>Checked Exp R</th>
            <th>Unchecked n</th>
            <th>Unchecked Exp R</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <td>
                {item.label}
                {item.required && <span className="req"> *</span>}
              </td>
              <td>{item.checked.n}</td>
              <td>{item.checked.expectancy_r ? `${item.checked.expectancy_r}R` : "—"}</td>
              <td>{item.unchecked.n}</td>
              <td>{item.unchecked.expectancy_r ? `${item.unchecked.expectancy_r}R` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin-bottom: 8px;
        }
        .tbl {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .tbl th,
        .tbl td {
          border: 1px solid var(--line);
          padding: 6px 8px;
        }
        .req {
          color: var(--muted);
        }
      `}</style>
    </Panel>
  );
}

export function EdgeMapPanel({ intel }: { intel: IntelligenceLab }) {
  const edges = intel.edge_maps.edge_map;
  const weak = intel.edge_maps.weakness_map;
  return (
    <>
      <Panel title="Personal Edge Map">
        {edges.length === 0 ? (
          <Empty>Need more trades with positive expectancy and adequate sample size.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Setup</th>
                <th>Symbol</th>
                <th>Session</th>
                <th>n</th>
                <th>Exp R</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((e) => (
                <tr key={`${e.setup}-${e.symbol}`}>
                  <td>{e.setup}</td>
                  <td>{e.symbol}</td>
                  <td>{e.session}</td>
                  <td>{e.n}</td>
                  <td>{e.expectancy_r ? `${e.expectancy_r}R` : "—"}</td>
                  <td>{e.edge_quality.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title="Weakness Map">
        {weak.length === 0 ? (
          <Empty>No significant weakness patterns detected.</Empty>
        ) : (
          <ul className="list">
            {weak.map((w) => (
              <li key={`${w.setup}-${w.symbol}`}>
                {w.setup} · {w.symbol} · {w.session} — {w.expectancy_r}R (n={w.n}). Historically underperformed your baseline.
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <style jsx>{`
        .tbl {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .tbl th,
        .tbl td {
          border: 1px solid var(--line);
          padding: 6px 8px;
        }
        .list {
          font-size: 13px;
          padding-left: 18px;
        }
      `}</style>
    </>
  );
}
