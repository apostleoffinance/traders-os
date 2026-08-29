"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { EquityLab, RiskAnalyticsLab } from "@/components/analytics/Phase2Lab";
import { RiskAndObservations } from "@/components/analytics/Sections";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function RiskTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="risk" />
      <EquityLab data={data} />
      <DeepDiveSection title="Risk research" description="Drawdown analytics, policy observations, and capital preservation metrics.">
        {data.lab?.risk_analytics && <RiskAnalyticsLab data={data} />}
        <RiskAndObservations data={data} />
        <QuantLabBridge variant="risk" compact />
      </DeepDiveSection>
    </>
  );
}
