# TraderOS Product & Engineering Overhaul

Status: Audit baseline and implementation plan  
Branch: product/ux-overhaul-audit  
Baseline reviewed: main at ed48283ca32182fb362e5a2acae98c8d7ff3550c

## Executive direction

TraderOS should evolve from a feature-rich journal into a coherent trading intelligence workspace. The product should make the next useful action obvious, preserve the trustworthiness of trading records and calculations, and connect a trader's plan, execution, market context, and outcomes.

The immediate priority is not to replace the existing stack or rebuild every screen. The repository already has substantial domain logic, analytics, risk tools, trade replay, AI guardrails, and account/MT5 support. The right approach is to simplify the user journey, consolidate repeated interaction patterns, protect the existing quantitative foundation, and expand the market-data layer behind stable interfaces.

## Verified baseline

The current repository contains:

- Next.js App Router / React / TypeScript frontend, custom token-based UI system, and Apache ECharts.
- FastAPI / Pydantic / SQLAlchemy / Alembic backend and PostgreSQL persistence.
- Account management, trade lifecycle screens, manual journal entry, risk profiles, account rules, analytics, reports, Quant Lab, Intelligence, trade replay, market routes, and MT5 sync.
- A Python engine layer covering FX math, account rules, risk, discipline, psychology, analytics, quant research, reporting, and replay.
- AI provider abstraction and guardrails intended to keep responses evidence-backed and prevent trading signals.
- A broad backend test suite and a smaller set of frontend test files.
- Existing product navigation with 13 destinations across four groups, including Analytics and a separate Calendar shortcut even though Calendar is also an Analytics tab.

This is a greenfield V1 with meaningful foundations, not an empty project. Avoid duplicating modules that already exist.

## Initial findings

### Product and UX

1. Navigation exposes too many peer destinations. Home, Trade Journal, New Trade, Calculator, Analytics, Calendar, Intelligence, Quant Lab, Risk, Reports, Market Lab, Accounts, and Settings are all presented in primary navigation. The user has to understand the internal feature map before understanding the workflow.
2. Feature names are not a complete workflow. The app needs to guide users through a simple loop: prepare a trade, record or import it, review the outcome, investigate patterns, and adjust process and risk.
3. Analytics has substantial breadth. Overview, Performance, Edge Explorer, Behaviour, Execution, Risk, and Calendar can be valuable, but should feel like one research workspace with consistent filters, sample-size cues, and drill-down behavior rather than separate mini-products.
4. New-trade entry is a high-value workflow. The form already includes risk preview, checklist, psychology, notes, screenshots, and post-trade fields. UX changes must reduce cognitive load without removing underlying detail or weakening pre-trade controls.
5. Design consistency needs to be enforced through shared primitives. The repo has token and UI/component foundations. New work should reuse these rather than introduce one-off styling systems or broad unreviewed CSS overrides.
6. A visual overhaul should preserve information density where it matters. Trading users need precise figures, clear states, and useful tables. Use hierarchy and progressive disclosure rather than decorative cards or oversized empty space.

### Engineering and quality

1. The product already has a layered architecture. Frontend pages and components call API routes; backend services handle persistence and authorization; deterministic engines own core calculations. Preserve and strengthen this boundary.
2. The canonical record model needs to remain reliable. Keep planned versus actual values distinct, preserve source IDs and raw import data for reconciliation, and store timestamps in UTC while rendering the user's selected IANA timezone.
3. Financial calculations require explicit currency and instrument handling. Do not move P&L, pip, R-multiple, risk, or account-rule calculations into frontend presentation code.
4. AI must remain downstream of validated analytics. It should consume approved evidence packages with filters, sample sizes, data-quality notes, and linked supporting trades—not unrestricted SQL or invented causal explanations. It must not provide buy/sell/entry signals.
5. Frontend verification is less explicit than backend verification. The frontend package defines build, start, and lint scripts but no standard test or type-check script, while frontend test files exist. Add a repeatable frontend verification path before broad UI refactors.
6. The charting decision should remain modular. Evaluate existing chart components and any proposed open-source alternative against license, commercial use, data-feed support, drawing/replay needs, maintenance, and bundle/performance costs. Do not assume OpenMarket/wrun is an embeddable chart or market-data backend.
7. Production startup previously accepted the documented development JWT signing key if the deployment secret was omitted. The overhaul branch now rejects the known example key and secrets shorter than 32 characters outside development, with focused regression tests. Production deployment configuration must still supply a unique secret.

## Target information architecture

Prefer a smaller primary navigation organized around trader intent:

- Workspace — Home and current account status.
- Journal — Trades, new trade, import/sync, trade detail, and replay.
- Research — Analytics, Calendar, Intelligence, Quant Lab, and Reports.
- Market — Market Lab, charting, and watchlists as the market workspace matures.
- Risk — account limits and portfolio/risk state.
- Manage — Accounts, integrations, and Settings.

This is a target information architecture, not permission to remove existing routes. Preserve direct URLs and query parameters during navigation refactors. Calendar should be discoverable from Research and Analytics without creating conflicting active states.

## Design principles

- Professional trading-workstation feel; restrained dark/light surfaces, no purple gradients.
- Strong typographic hierarchy and consistent spacing, controls, tables, empty states, and feedback.
- Show the answer first, then supporting evidence, then drill-down.
- Label sample size, period, filters, and data freshness wherever they materially affect interpretation.
- Separate decision quality from trade outcome: a good process can lose; a poor process can win.
- Distinguish realized from unrealized P&L, planned risk from actual risk, and imported facts from estimates.
- Accessible keyboard focus, semantic controls, responsive behavior, and useful loading/error/empty states.
- Never show fabricated market prices or present mock research numbers as real observations.

## Phased implementation plan

### Phase 0 — Baseline and safety
- Keep all work on this feature branch; do not commit exploratory changes directly to main.
- Inventory page ownership, shared UI primitives, data-fetching patterns, migrations, and tests.
- Establish frontend type-check/test/build commands and record baseline results.
- Identify high-risk calculations and import/authz paths that must not regress.

### Phase 1 — UX foundation
- Define coherent primary navigation and consistent page headers/actions.
- Standardize loading, empty, error, success, filter, metric, chart, and table patterns.
- Make global account and period context visible without competing with the page's main task.
- Simplify the dashboard hierarchy around account/risk status, current-period performance, next useful investigation, and recent activity.
- Make New Trade a progressive workflow: core setup first, optional context/review details when relevant, persistent live risk preview and clear validation.

### Phase 2 — Journal quality
- Improve trade blotter filters, table density, import/reconciliation feedback, and trade-detail reading order.
- Keep planned thesis, actual execution, outcome, and review as separate sections.
- Ensure replay/chart overlays clearly label data source and gaps.
- Add regression tests for trade lifecycle, imported duplicates, and key form calculations.

### Phase 3 — Research workspace
- Unify filters, drill-downs, sample-size messaging, and navigation across analytics tabs.
- Put deterministic findings and supporting trades ahead of AI-generated prose.
- Ensure all insights disclose period, filters, sample size, and limitations.
- Keep Calendar a temporal investigation surface that links into individual trades and analytics.

### Phase 4 — Risk and execution
- Present account limits and utilization as actionable, configurable risk state.
- Separate planned risk, realized risk, open exposure, fees, swaps/funding, and slippage.
- Strengthen broker/exchange import idempotency and reconciliation before adding live execution.
- Keep account rules server-authoritative and tested.

### Phase 5 — Market data and charting
- Define a provider-independent instrument and candle interface.
- Start with one FX path and one crypto path; label coverage, latency, and data gaps.
- Store trade-linked/versioned market snapshots instead of retaining all ticks by default.
- Evaluate charting candidates with a small proof of concept; retain the ability to swap providers/components.

### Phase 6 — Evidence-backed AI researcher
- Build a planner over approved analytics functions, not arbitrary SQL.
- Return a structured evidence package: metrics, sample sizes, comparison periods, filters, caveats, and supporting trades.
- Reject trading-signal requests and unsupported causal claims.
- Test provider failure, malformed output, cross-user isolation, prompt injection, and low-sample answers.

### Phase 7 — Advanced research
- Add backtesting, historical replay, transaction-cost modeling, robustness checks, and walk-forward analysis only after data provenance and calculations are validated.
- Add derivatives and on-chain datasets when a concrete research use case and provider terms justify them.
- Treat live execution as a separate future security/risk project.

## Definition of done

- Uses existing domain services and shared components where appropriate.
- Has a clear user problem and acceptance criteria.
- Preserves authorization, tenant isolation, and financial calculation ownership.
- Includes relevant unit/integration tests or documents why they cannot be run.
- Passes frontend type-check/build/lint and relevant backend tests where tooling is available.
- Shows meaningful loading, empty, error, and success states.
- Does not silently change database semantics, historical records, or deployment configuration.
- Is reviewed on a branch before merging to main.

## Immediate next implementation slice

1. Establish frontend verification commands and run the existing baseline.
2. Refactor primary navigation around the product workflow while preserving every route.
3. Improve dashboard hierarchy and account/risk context.
4. Standardize trade-entry and analytics filter patterns.
5. Work through journal, research, market data, and AI in that order.

The sequence is intentionally conservative: stabilize UX and existing data contracts first, then expand capabilities. The existing stack is adequate for these phases; architecture changes should be justified by a specific limitation, not by a desire to rebuild.
