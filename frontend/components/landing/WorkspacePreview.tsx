import { Badge, LimitBar, Panel, Stat } from "@/components/ui";
import { EquitySparkline } from "@/components/EquitySparkline";
import { SAMPLE_EQUITY, SAMPLE_EVIDENCE, SAMPLE_LABEL, SAMPLE_LIMITS, SAMPLE_TRADES } from "./sample";

export function WorkspacePreview() {
  return (
    <div className="lp-workspace-grid">
      <div className="lp-frame">
        <p className="lp-example">{SAMPLE_LABEL} · Dashboard</p>
        <Panel title="Command">
          <div className="lp-preview-kpis">
            <Stat label="Expectancy" value={SAMPLE_EVIDENCE[0].value} tone="pos" />
            <Stat label="Win rate" value={SAMPLE_EVIDENCE[1].value} />
            <Stat label="Health" value="74" tone="ok" />
          </div>
          <EquitySparkline series={SAMPLE_EQUITY} width={360} height={52} />
        </Panel>
      </div>
      <div className="lp-frame">
        <p className="lp-example">{SAMPLE_LABEL} · Analytics</p>
        <Panel title="Session expectancy">
          <div className="lp-bars" aria-hidden>
            <div className="lp-bar">
              <span>London</span>
              <i style={{ width: "78%" }} className="pos-bar" />
              <em className="num pos">+0.47R</em>
            </div>
            <div className="lp-bar">
              <span>NY</span>
              <i style={{ width: "52%" }} className="pos-bar" />
              <em className="num pos">+0.18R</em>
            </div>
            <div className="lp-bar">
              <span>Asia</span>
              <i style={{ width: "28%" }} className="neg-bar" />
              <em className="num neg">−0.12R</em>
            </div>
          </div>
        </Panel>
      </div>
      <div className="lp-frame">
        <p className="lp-example">{SAMPLE_LABEL} · Risk</p>
        <Panel title="Limits" right={<Badge status="green" />}>
          <LimitBar label={SAMPLE_LIMITS[0].label} limit={SAMPLE_LIMITS[0].limit} remaining={SAMPLE_LIMITS[0].remaining} />
          <LimitBar label={SAMPLE_LIMITS[1].label} limit={SAMPLE_LIMITS[1].limit} remaining={SAMPLE_LIMITS[1].remaining} />
        </Panel>
      </div>
      <div className="lp-frame">
        <p className="lp-example">{SAMPLE_LABEL} · Intelligence</p>
        <Panel title="Finding">
          <p className="lp-finding">
            Your worst-performing trades tend to occur when you increase risk after a loss.
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
              <dt>Sample</dt>
              <dd className="num">47 trades</dd>
            </div>
          </dl>
          <p className="muted lp-tiny">
            {SAMPLE_TRADES.length} recent rows shown for layout only. Statistics are calculated by the analytics
            engine; AI interprets the structured result.
          </p>
        </Panel>
      </div>
    </div>
  );
}
