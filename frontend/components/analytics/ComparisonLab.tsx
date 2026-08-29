"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { Field, Panel } from "@/components/ui";
import { Empty } from "@/components/analytics/Charts";
import { money, num, signed } from "@/lib/format";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { globalPeriodToPreset } from "@/lib/analytics";
import { useGlobalFilters } from "@/lib/filters";

export type ComparisonResult = {
  group_a: { label: string; n: number; win_rate: string | null; expectancy_r: string | null; net_pnl: string; confidence: { confidence_level: string } };
  group_b: { label: string; n: number; win_rate: string | null; expectancy_r: string | null; net_pnl: string; confidence: { confidence_level: string } };
  comparison: { metric: string; a: string | number | null; b: string | number | null; difference: string | null }[];
  statistical_notes: { effect_size: string | null; disclaimer: string; bootstrap_r_difference?: { available: boolean } };
  universe_n: number;
};

type GroupDraft = {
  label: string;
  session: string;
  symbol: string;
  direction: string;
  min_discipline: string;
  max_discipline: string;
  emotional: string;
};

const EMPTY_GROUP = (label: string): GroupDraft => ({
  label,
  session: "",
  symbol: "",
  direction: "",
  min_discipline: "",
  max_discipline: "",
  emotional: "",
});

function GroupFilters({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: GroupDraft;
  onChange: (v: GroupDraft) => void;
  options: AnalyticsDashboard["filters"]["options"];
}) {
  return (
    <div className="col">
      <h3>{title}</h3>
      <Field label="Label">
        <input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </Field>
      <Field label="Session">
        <select value={value.session} onChange={(e) => onChange({ ...value, session: e.target.value })}>
          <option value="">Any</option>
          {options.sessions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Symbol">
        <select value={value.symbol} onChange={(e) => onChange({ ...value, symbol: e.target.value })}>
          <option value="">Any</option>
          {options.symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Direction">
        <select value={value.direction} onChange={(e) => onChange({ ...value, direction: e.target.value })}>
          <option value="">Any</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </Field>
      <Field label="Min discipline">
        <input
          type="number"
          min={0}
          max={100}
          value={value.min_discipline}
          onChange={(e) => onChange({ ...value, min_discipline: e.target.value })}
          placeholder="e.g. 85"
        />
      </Field>
      <Field label="Max discipline">
        <input
          type="number"
          min={0}
          max={100}
          value={value.max_discipline}
          onChange={(e) => onChange({ ...value, max_discipline: e.target.value })}
          placeholder="e.g. 69"
        />
      </Field>
      <Field label="Emotional">
        <select value={value.emotional} onChange={(e) => onChange({ ...value, emotional: e.target.value })}>
          <option value="">Any</option>
          <option value="false">Non-emotional only</option>
          <option value="true">Emotional only</option>
        </select>
      </Field>
      <style jsx>{`
        .col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }
        h3 {
          font-size: 14px;
          margin: 0 0 4px;
        }
        .col :global(input),
        .col :global(select) {
          width: 100%;
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}

function buildQuery(accountId: string, preset: string, a: GroupDraft, b: GroupDraft): string {
  const p = new URLSearchParams({ account_id: accountId, preset });
  const add = (prefix: string, g: GroupDraft) => {
    p.set(`${prefix}_label`, g.label);
    if (g.session) p.set(`${prefix}_session`, g.session);
    if (g.symbol) p.set(`${prefix}_symbol`, g.symbol);
    if (g.direction) p.set(`${prefix}_direction`, g.direction);
    if (g.min_discipline) p.set(`${prefix}_min_discipline`, g.min_discipline);
    if (g.max_discipline) p.set(`${prefix}_max_discipline`, g.max_discipline);
    if (g.emotional) p.set(`${prefix}_emotional`, g.emotional);
  };
  add("a", a);
  add("b", b);
  return p.toString();
}

export function ComparisonLab({ accountId, data }: { accountId: string; data: AnalyticsDashboard }) {
  const { filters: globalFilters } = useGlobalFilters();
  const [groupA, setGroupA] = useState<GroupDraft>({ ...EMPTY_GROUP("Group A"), session: "london", label: "London" });
  const [groupB, setGroupB] = useState<GroupDraft>({ ...EMPTY_GROUP("Group B"), session: "new_york", label: "New York" });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const currency = data.account.currency;

  const compare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const preset = globalPeriodToPreset(globalFilters.period);
      const q = buildQuery(accountId, preset, groupA, groupB);
      setResult(await api<ComparisonResult>(`/api/analytics/comparison?${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, globalFilters.period, groupA, groupB]);

  const presets = (data.lab?.intelligence?.comparisons as { presets?: ComparisonResult[] } | undefined)?.presets;

  return (
    <div className="comparison-lab">
      <Panel title="Comparison Lab">
        <p className="muted">Define two trade groups and compare metrics. Differences are descriptive — not predictive.</p>
        <div className="cols">
          <GroupFilters title="Group A" value={groupA} onChange={setGroupA} options={data.filters.options} />
          <GroupFilters title="Group B" value={groupB} onChange={setGroupB} options={data.filters.options} />
        </div>
        <button type="button" className="compare-btn" onClick={() => void compare()} disabled={loading}>
          {loading ? "Comparing…" : "Compare groups"}
        </button>
        {error && <p className="err">{error}</p>}

        {presets && presets.length > 0 && !result && (
          <div className="presets">
            <p className="muted">Quick presets from your data:</p>
            {presets.map((p) => (
              <button
                key={`${p.group_a.label}-${p.group_b.label}`}
                type="button"
                className="preset-btn"
                onClick={() => setResult(p as ComparisonResult)}
              >
                {p.group_a.label} vs {p.group_b.label}
              </button>
            ))}
          </div>
        )}

        {result && (
          <>
            <div className="summary">
              <div>
                <strong>{result.group_a.label}</strong>
                <span>{result.group_a.n} trades · {result.group_a.confidence.confidence_level}</span>
                <span>Exp {result.group_a.expectancy_r ? `${result.group_a.expectancy_r}R` : "—"}</span>
              </div>
              <div>
                <strong>{result.group_b.label}</strong>
                <span>{result.group_b.n} trades · {result.group_b.confidence.confidence_level}</span>
                <span>Exp {result.group_b.expectancy_r ? `${result.group_b.expectancy_r}R` : "—"}</span>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>{result.group_a.label}</th>
                  <th>{result.group_b.label}</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {result.comparison.map((row) => (
                  <tr key={row.metric}>
                    <td>{row.metric}</td>
                    <td>{row.metric === "net_pnl" && row.a ? money(String(row.a), currency) : row.a ?? "—"}</td>
                    <td>{row.metric === "net_pnl" && row.b ? money(String(row.b), currency) : row.b ?? "—"}</td>
                    <td>{row.difference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              {result.statistical_notes.disclaimer}
              {result.statistical_notes.effect_size && ` Effect size: ${result.statistical_notes.effect_size}.`}
            </p>
          </>
        )}

        {!result && !loading && <Empty>Select filters and compare, or use a preset.</Empty>}
      </Panel>
      <style jsx>{`
        .comparison-lab {
          margin-bottom: 24px;
        }
        .muted {
          font-size: 13px;
          margin-bottom: 12px;
        }
        .cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 16px;
        }
        .compare-btn {
          margin-bottom: 14px;
          padding: 8px 16px;
          cursor: pointer;
        }
        .presets {
          margin-bottom: 12px;
        }
        .preset-btn {
          margin-right: 8px;
          margin-bottom: 6px;
          font-size: 12px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .summary {
          display: flex;
          gap: 24px;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .summary div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tbl {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .tbl th,
        .tbl td {
          border: 1px solid var(--line);
          padding: 6px 8px;
        }
        .err {
          color: var(--neg, #c44);
          font-size: 13px;
        }
        @media (max-width: 900px) {
          .cols {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
