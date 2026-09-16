"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { RiskAnalyticsLab } from "@/components/analytics/Phase2Lab";
import { RiskBudgetPanel } from "@/components/trader";
import { RiskEquitySection } from "@/components/analytics/risk/RiskEquitySection";
import { DrawdownRecoveryTable } from "@/components/analytics/risk/DrawdownRecoveryTable";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Risk: Decision (budget) → Evidence (equity) → Deep dive. */
export function RiskTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <DisclosureLayer kind="decision">
        <RiskBudgetPanel data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <RiskEquitySection data={data} />
      </DisclosureLayer>
      <DeepDiveSection title="More detail">
        <DrawdownRecoveryTable data={data} />
        {data.lab?.risk_analytics ? <RiskAnalyticsLab data={data} /> : null}
        <QuantLabBridge variant="risk" />
      </DeepDiveSection>
    </>
  );
}
