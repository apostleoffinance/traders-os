from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class EvidenceConfidence(StrEnum):
    INSUFFICIENT = "INSUFFICIENT"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class DisciplineLabel(StrEnum):
    POOR = "POOR"
    MIXED = "MIXED"
    GOOD = "GOOD"
    EXCELLENT = "EXCELLENT"


class FinancialOutcome(StrEnum):
    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    FLAT = "FLAT"
    OPEN = "OPEN"


class TradeReviewResponse(BaseModel):
    summary: str
    financial_outcome: FinancialOutcome
    execution_quality: int = Field(ge=0, le=100)
    discipline_assessment: DisciplineLabel
    behavioral_observations: list[str] = Field(default_factory=list)
    rule_violations: list[str] = Field(default_factory=list)
    positive_behaviors: list[str] = Field(default_factory=list)
    areas_to_review: list[str] = Field(default_factory=list)
    historical_context: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class JournalSummaryResponse(BaseModel):
    summary: str
    recent_performance: list[str] = Field(default_factory=list)
    recurring_mistakes: list[str] = Field(default_factory=list)
    recurring_strengths: list[str] = Field(default_factory=list)
    psychology: list[str] = Field(default_factory=list)
    risk_behavior: list[str] = Field(default_factory=list)
    session_behavior: list[str] = Field(default_factory=list)
    setup_behavior: list[str] = Field(default_factory=list)
    questions_to_investigate: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class BehavioralAnalysisResponse(BaseModel):
    summary: str
    patterns: list[str] = Field(default_factory=list)
    revenge_or_fomo: list[str] = Field(default_factory=list)
    risk_escalation: list[str] = Field(default_factory=list)
    overtrading: list[str] = Field(default_factory=list)
    session_adherence: list[str] = Field(default_factory=list)
    suggested_investigations: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class PatternItem(BaseModel):
    title: str
    observation: str
    evidence: str
    sample_size: int
    confidence: EvidenceConfidence
    why_it_matters: str
    suggested_investigation: str


class PatternAnalysisResponse(BaseModel):
    summary: str
    patterns: list[PatternItem] = Field(default_factory=list)
    data_limitations: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class PeriodReviewResponse(BaseModel):
    period_label: str
    summary: str
    vs_previous: list[str] = Field(default_factory=list)
    what_went_well: list[str] = Field(default_factory=list)
    what_went_poorly: list[str] = Field(default_factory=list)
    behavioral_patterns: list[str] = Field(default_factory=list)
    risk_behavior: list[str] = Field(default_factory=list)
    psychology: list[str] = Field(default_factory=list)
    strongest_evidence: list[str] = Field(default_factory=list)
    weakest_evidence: list[str] = Field(default_factory=list)
    questions_to_investigate: list[str] = Field(default_factory=list)
    process_focus: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class WeeklyReviewResponse(PeriodReviewResponse):
    """Kept so previously cached weekly rows still validate if re-read as this type."""


class MonthlyReviewResponse(PeriodReviewResponse):
    pass


class CoachResponse(BaseModel):
    summary: str
    biggest_recurring_mistakes: list[str] = Field(default_factory=list)
    conditions_associated_with_better_process: list[str] = Field(default_factory=list)
    discipline_trend: str
    work_on_this_week: list[str] = Field(default_factory=list)
    questions_to_investigate: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


class ChallengeTradeResponse(BaseModel):
    summary: str
    supporting_evidence: list[str] = Field(default_factory=list)
    contradicting_evidence: list[str] = Field(default_factory=list)
    behavioral_concerns: list[str] = Field(default_factory=list)
    data_limitations: list[str] = Field(default_factory=list)
    questions_to_investigate: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence
    recommendation: Literal["none"] = "none"


class QuantResearchResponse(BaseModel):
    summary: str
    edge_assessment: list[str] = Field(default_factory=list)
    stability_and_robustness: list[str] = Field(default_factory=list)
    research_opportunities: list[str] = Field(default_factory=list)
    walk_forward_interpretation: list[str] = Field(default_factory=list)
    behavioral_patterns: list[str] = Field(default_factory=list)
    data_limitations: list[str] = Field(default_factory=list)
    questions_to_investigate: list[str] = Field(default_factory=list)
    confidence: EvidenceConfidence


SCHEMA_BY_TYPE: dict[str, type[BaseModel]] = {
    "trade_review": TradeReviewResponse,
    "journal_summary": JournalSummaryResponse,
    "behavioral_analysis": BehavioralAnalysisResponse,
    "pattern_analysis": PatternAnalysisResponse,
    "period_review": PeriodReviewResponse,
    "weekly_review": PeriodReviewResponse,
    "monthly_review": PeriodReviewResponse,
    "coach": CoachResponse,
    "challenge_trade": ChallengeTradeResponse,
    "quant_research": QuantResearchResponse,
}
