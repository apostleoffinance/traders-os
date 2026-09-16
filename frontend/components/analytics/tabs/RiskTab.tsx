"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { RiskAnalyticsLab } from "@/components/analytics/Phase2Lab";
import { RiskBudgetPanel } from "@/components/trader";
import { RiskEquitySection } from "@/components/analytics/risk/RiskEquitySection";
import { DrawdownRecoveryTable } from "@/components/analytics/risk/DrawdownRecoveryTable";
import { KeyObservationsPanel } from "@/components/analytics/risk/KeyObservationsPanel";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Risk: Decision (budget) → Evidence (equity) → Deep dive. */
export function RiskTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="risk" />
      <DisclosureLayer kind="decision">
        <RiskBudgetPanel data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <RiskEquitySection data={data} />
        <KeyObservationsPanel data={data} />
      </DisclosureLayer>
      <DeepDiveSection
        title="Risk research"
        description="Recovery episodes, risk distribution, consistency, and Quant Lab bridges — optional detail."
      >
        <DrawdownRecoveryTable data={data} />
        {data.lab?.risk_analytics ? <RiskAnalyticsLab data={data} /> : null}
        <QuantLabBridge variant="risk" compact />
      </DeepDiveSection>
    </>
  );
}
