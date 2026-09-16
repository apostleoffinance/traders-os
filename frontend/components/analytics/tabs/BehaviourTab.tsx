"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
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

/** Behaviour: process → signals → charts (no deep-dive accordion). */
export function BehaviourTab({ data }: { data: AnalyticsDashboard }) {
  const intel = data.lab?.intelligence;
  const currency = data.account.currency;

  return (
    <>
      <DisclosureLayer kind="decision">
        {intel ? <DecisionQualitySummary intel={intel} /> : null}
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <BehaviourSignals data={data} intel={intel} />
        <BehaviourLab data={data} />
        {intel && <DecisionQualityChart intel={intel} />}
        {intel && <PsychologyBubbleMatrix intel={intel} currency={currency} />}
        {intel && <DisciplineScatterPanel intel={intel} currency={currency} />}
        {intel && <BehaviourIntelligenceLab intel={intel} />}
        {intel && <ChecklistItemPanel intel={intel} />}
        <QuantLabBridge variant="behaviour" />
      </DisclosureLayer>
    </>
  );
}
