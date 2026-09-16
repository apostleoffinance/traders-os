"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { BehaviourLab } from "@/components/analytics/BehaviourLab";
import { DecisionQualitySummary } from "@/components/analytics/behaviour/DecisionQualitySummary";
import { BehaviourSignals } from "@/components/analytics/behaviour/BehaviourSignals";
import { BehaviourIntelligenceLab, ChecklistItemPanel } from "@/components/intelligence/Phase3Intelligence";
import {
  DecisionQualityChart,
  DisciplineScatterPanel,
  PsychologyBubbleMatrix,
} from "@/components/intelligence/IntelligenceViz";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Behaviour: Decision (process) → Evidence (signals) → Deep dive. */
export function BehaviourTab({ data }: { data: AnalyticsDashboard }) {
  const intel = data.lab?.intelligence;
  const currency = data.account.currency;

  return (
    <>
      <AnalyticsTabIntro page="behaviour" />
      <DisclosureLayer kind="decision">
        {intel ? <DecisionQualitySummary intel={intel} /> : null}
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <BehaviourSignals data={data} intel={intel} />
        <BehaviourLab data={data} />
      </DisclosureLayer>
      <DeepDiveSection
        title="Psychology & discipline research"
        description="Bubble maps, discipline scatter, streak tables, and checklist detail — optional when you want to dig deeper."
      >
        {intel && <DecisionQualityChart intel={intel} />}
        {intel && <PsychologyBubbleMatrix intel={intel} currency={currency} />}
        {intel && <DisciplineScatterPanel intel={intel} currency={currency} />}
        {intel && <BehaviourIntelligenceLab intel={intel} />}
        {intel && <ChecklistItemPanel intel={intel} />}
        <QuantLabBridge variant="behaviour" compact />
      </DeepDiveSection>
    </>
  );
}
