"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { BehaviourLab } from "@/components/analytics/BehaviourLab";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { RiskAnalyticsLab } from "@/components/analytics/Phase2Lab";
import { BehaviourIntelligenceLab, ChecklistItemPanel } from "@/components/intelligence/Phase3Intelligence";
import { DecisionQualityChart, DisciplineScatterPanel, PsychologyBubbleMatrix } from "@/components/intelligence/IntelligenceViz";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function BehaviourTab({ data }: { data: AnalyticsDashboard }) {
  const intel = data.lab?.intelligence;
  const currency = data.account.currency;

  return (
    <>
      <AnalyticsTabIntro page="behaviour" />
      <BehaviourLab data={data} />
      <DeepDiveSection title="Psychology & discipline research" description="Advanced behavioural visualizations from your journal metadata.">
        {intel && <PsychologyBubbleMatrix intel={intel} currency={currency} />}
        {intel && <DisciplineScatterPanel intel={intel} currency={currency} />}
        {intel && <BehaviourIntelligenceLab intel={intel} />}
        {intel && <ChecklistItemPanel intel={intel} />}
        {intel && <DecisionQualityChart intel={intel} />}
        {data.lab?.risk_analytics && <RiskAnalyticsLab data={data} />}
        <QuantLabBridge variant="behaviour" compact />
      </DeepDiveSection>
    </>
  );
}
