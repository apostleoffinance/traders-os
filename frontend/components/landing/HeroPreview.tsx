import { Badge, Panel, Stat } from "@/components/ui";
import { EquitySparkline } from "@/components/EquitySparkline";
import { SAMPLE_EQUITY, SAMPLE_LABEL, SAMPLE_TRADES } from "./sample";

export function HeroPreview() {
  return (
    <div className="lp-preview" aria-label="Trader OS workspace preview">
      <p className="lp-example">{SAMPLE_LABEL}</p>
      <Panel title="Command Center">
        <div className="lp-preview-head">
          <div>
            <div className="lp-preview-acct">Example account</div>
            <div className="muted">Risk · Discipline · History</div>
          </div>
          <Badge status="green" />
        </div>
        <div className="lp-preview-kpis">
          <Stat label="Equity" value="$21,643.32" tone="pos" />
          <Stat label="Expectancy" value="+0.31R" tone="pos" />
          <Stat label="Win rate" value="63%" />
          <Stat label="Profit factor" value="1.89" tone="ok" />
        </div>
        <div className="lp-spark">
          <EquitySparkline series={SAMPLE_EQUITY} width={420} height={64} />
        </div>
        <table className="blotter">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Dir</th>
              <th>R</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_TRADES.map((t) => (
              <tr key={`${t.symbol}-${t.session}`}>
                <td>{t.symbol}</td>
                <td>{t.dir}</td>
                <td className={`num ${t.result === "win" ? "pos" : "neg"}`}>{t.r}</td>
                <td className="muted">{t.session}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
