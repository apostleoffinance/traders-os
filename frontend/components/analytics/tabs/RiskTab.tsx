"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { RiskAnalyticsLab } from "@/components/analytics/Phase2Lab";
import { RiskBudgetPanel } from "@/components/trader";
import { RiskEquitySection } from "@/components/analytics/risk/RiskEquitySection";
import { DrawdownRecoveryTable } from "@/components/analytics/risk/DrawdownRecoveryTable";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Risk: budget → equity → recovery (no deep-dive accordion). */
export function RiskTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <DisclosureLayer kind="decision">
        <RiskBudgetPanel data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <RiskEquitySection data={data} />
        <DrawdownRecoveryTable data={data} />
        {data.lab?.risk_analytics ? <RiskAnalyticsLab data={data} /> : null}
        <QuantLabBridge variant="risk" />
      </DisclosureLayer>
    </>
  );
}
