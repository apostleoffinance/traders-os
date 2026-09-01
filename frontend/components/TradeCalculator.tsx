"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, getActiveAccountId } from "@/lib/api";
import { saveCalcPlan } from "@/lib/calcPlan";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { money, num } from "@/lib/format";

export type CalcMode =
  | "fixed_risk_sl"
  | "risk_to_levels"
  | "entry_sl_to_size"
  | "trade_analysis"
  | "target_distance";

type Instrument = {
  symbol: string;
  display_symbol: string;
  asset_class: string;
  size_unit: string;
  price_precision: number;
};

type ConversionInfo = {
  rate: string | null;
  base?: string;
  quote?: string;
  source?: string | null;
  timestamp?: string | null;
  cached?: boolean;
  freshness?: string;
  age_seconds?: number | null;
  assumed?: boolean;
  reason?: string | null;
  pair?: string | null;
  quote_price?: string | null;
  stale_blocked?: boolean;
  market?: MarketInfo | null;
};

type MarketInfo = {
  symbol?: string;
  last?: string | number;
  provider?: string;
  timestamp?: string;
  freshness?: string;
  cached?: boolean;
  age_seconds?: number | null;
  warning?: string;
};

type CalcResult = {
  calculation: {
    ok: boolean;
    mode: string;
    symbol: string;
    direction: string;
    entry: string | null;
    stop_loss: string | null;
    take_profit: string | null;
    lot_size: string | null;
    size_unit: string;
    stop_pips: string | null;
    tp_pips: string | null;
    risk_amount: string | null;
    requested_risk: string | null;
    risk_difference: string | null;
    reward_amount: string | null;
    planned_rr: string | null;
    risk_percent: string | null;
    errors: string[];
    notes: string[];
  };
  policy: {
    status: string;
    headline: string;
    details: string[];
    account: { balance: string; equity: string };
    trade_risk: Record<string, string | null>;
    account_impact: Record<string, string>;
  } | null;
  conversion?: ConversionInfo;
  market?: MarketInfo | null;
};

const MODES: { id: CalcMode; label: string; hint: string }[] = [
  { id: "fixed_risk_sl", label: "Fixed risk + SL → size", hint: "Default. Entry, stop, max risk → position size." },
  { id: "risk_to_levels", label: "Risk → SL / TP", hint: "Lot + risk $ + reward $ → stop and target prices." },
  { id: "entry_sl_to_size", label: "Entry + SL → size", hint: "Same as fixed risk + SL." },
  { id: "trade_analysis", label: "Entry + SL + TP → analysis", hint: "Given size and levels, compute risk and R:R." },
  { id: "target_distance", label: "Target profit → distance", hint: "Lot + target $ → take-profit price." },
];

type Props = {
  compact?: boolean;
  initial?: Partial<{
    symbol: string;
    direction: string;
    entry: string;
    stop_loss: string;
    take_profit: string;
    lot_size: string;
    risk_amount: string;
  }>;
  onApply?: (values: {
    symbol: string;
    direction: string;
    entry: string;
    stop_loss: string;
    take_profit: string;
    lot_size: string;
  }) => void;
};

export function TradeCalculator({ compact = false, initial, onApply }: Props) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [mode, setMode] = useState<CalcMode>("fixed_risk_sl");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "EURUSD");
  const [direction, setDirection] = useState(initial?.direction ?? "short");
  const [entry, setEntry] = useState(initial?.entry ?? "1.16646");
  const [sl, setSl] = useState(initial?.stop_loss ?? "1.17146");
  const [tp, setTp] = useState(initial?.take_profit ?? "");
  const [lot, setLot] = useState(initial?.lot_size ?? "0.01");
  const [risk, setRisk] = useState(initial?.risk_amount ?? "5");
  const [reward, setReward] = useState("10");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nl, setNl] = useState("");
  const [explain, setExplain] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ account_name?: string; risk_per_trade?: string; equity?: string } | null>(null);
  const [allowStale, setAllowStale] = useState(false);

  useEffect(() => {
    setAccountId(getActiveAccountId());
    const on = () => setAccountId(getActiveAccountId());
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, []);

  useEffect(() => {
    void api<{ instruments: Instrument[] }>("/api/calculator/instruments").then((r) => setInstruments(r.instruments));
  }, []);

  useEffect(() => {
    if (!initial?.symbol) return;
    const key = initial.symbol.toUpperCase().replace(/\//g, "");
    if (instruments.length === 0) {
      setSymbol(key);
      return;
    }
    if (instruments.some((i) => i.symbol === key)) {
      setSymbol(key);
    }
  }, [initial?.symbol, instruments]);

  useEffect(() => {
    if (!accountId) return;
    void api<typeof ctx>(`/api/calculator/account-context?account_id=${accountId}`)
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [accountId]);

  const showLot = mode === "risk_to_levels" || mode === "trade_analysis" || mode === "target_distance";
  const showSl = mode === "fixed_risk_sl" || mode === "entry_sl_to_size" || mode === "trade_analysis" || mode === "target_distance";
  const showTp = mode === "trade_analysis";
  const showRisk = mode !== "trade_analysis" && mode !== "target_distance";
  const showReward = mode === "risk_to_levels" || mode === "target_distance";
  const slOptional = mode === "target_distance";

  const calculate = useCallback(async () => {
    if (!accountId) {
      setError("Select an account first.");
      return;
    }
    setBusy(true);
    setError(null);
    setExplain(null);
    try {
      const body: Record<string, unknown> = {
        account_id: accountId,
        mode,
        symbol,
        direction,
        entry,
        allow_stale_conversion: allowStale,
      };
      if (showLot && lot) body.lot_size = lot;
      if (showSl && sl) body.stop_loss = sl;
      if (showTp && tp) body.take_profit = tp;
      if (slOptional && sl) body.stop_loss = sl;
      if (showRisk && risk) body.risk_amount = risk;
      if (showReward && reward) body.reward_amount = reward;
      const data = await api<CalcResult>("/api/calculator/calculate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
      if (!data.calculation.ok) {
        setError(data.calculation.errors.join(" ") || "Calculation failed.");
      }
    } catch (err) {
      setResult(null);
      if (err instanceof ApiError) {
        const detail = err.body as { detail?: { message?: string } | string };
        const msg =
          typeof detail?.detail === "object"
            ? detail.detail?.message
            : typeof detail?.detail === "string"
              ? detail.detail
              : err.message;
        setError(msg ?? "Calculation failed.");
      } else {
        setError("Calculation failed.");
      }
    } finally {
      setBusy(false);
    }
  }, [accountId, mode, symbol, direction, entry, lot, sl, tp, risk, reward, showLot, showSl, showTp, showRisk, showReward, slOptional, allowStale]);

  async function parseNl() {
    if (!accountId || !nl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await api<{
        ready: boolean;
        missing_fields: string[];
        draft: Record<string, string | null>;
        notes: string[];
        disclaimer: string;
      }>("/api/calculator/parse", {
        method: "POST",
        body: JSON.stringify({ account_id: accountId, text: nl }),
      });
      const d = parsed.draft;
      if (d.symbol) setSymbol(d.symbol);
      if (d.direction) setDirection(d.direction);
      if (d.mode) setMode(d.mode as CalcMode);
      if (d.entry) setEntry(d.entry);
      if (d.stop_loss) setSl(d.stop_loss);
      if (d.take_profit) setTp(d.take_profit);
      if (d.lot_size) setLot(d.lot_size);
      if (d.risk_amount) setRisk(d.risk_amount);
      if (d.reward_amount) setReward(d.reward_amount);
      if (!parsed.ready) {
        setError(`Calculation requires additional information: ${parsed.missing_fields.join(", ")}.`);
        return;
      }
      await calculate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not interpret that request.");
    } finally {
      setBusy(false);
    }
  }

  async function runExplain() {
    if (!accountId || !result?.calculation.ok) return;
    setBusy(true);
    try {
      const data = await api<{ explanation: string; disclaimer: string }>("/api/calculator/explain", {
        method: "POST",
        body: JSON.stringify({
          account_id: accountId,
          calculation: result.calculation,
          policy: result.policy,
        }),
      });
      setExplain(`${data.explanation}\n\n${data.disclaimer}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to explain.");
    } finally {
      setBusy(false);
    }
  }

  const calc = result?.calculation;
  const policy = result?.policy;

  const applyValues = useMemo(() => {
    if (!calc?.ok) return null;
    return {
      symbol: calc.symbol,
      direction: calc.direction,
      entry: calc.entry ?? entry,
      stop_loss: calc.stop_loss ?? sl,
      take_profit: calc.take_profit ?? tp,
      lot_size: calc.lot_size ?? lot,
    };
  }, [calc, entry, sl, tp, lot]);

  function addToTradePlan() {
    if (!applyValues) return;
    saveCalcPlan({
      symbol: applyValues.symbol,
      direction: applyValues.direction as "long" | "short",
      entry: applyValues.entry,
      stop_loss: applyValues.stop_loss || null,
      take_profit: applyValues.take_profit || null,
      lot_size: applyValues.lot_size || null,
    });
    if (onApply) {
      onApply(applyValues);
      return;
    }
    router.push("/trades/new");
  }

  function useValues() {
    if (!applyValues || !onApply) return;
    onApply(applyValues);
  }

  return (
    <div className={`calc ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="head">
          <div>
            <p className="page-kicker">Workspace</p>
            <h1>Trade Calculator</h1>
            <p className="muted">Calculate risk, position size and trade parameters. Not a signal tool.</p>
          </div>
          {ctx && (
            <div className="acct muted">
              <div>{ctx.account_name}</div>
              <div>
                Equity {money(ctx.equity)} · Max risk/trade {money(ctx.risk_per_trade)}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <Alert kind="danger">{error}</Alert>}

      {!compact && (
        <Panel title="Natural language (optional)">
          <Field label="Describe your idea">
            <textarea
              rows={2}
              value={nl}
              onChange={(e) => setNl(e.target.value)}
              placeholder='e.g. Short EURUSD at 1.16646, risk $5, use 0.01 lot and target $10.'
            />
          </Field>
          <p className="muted tiny">AI extracts parameters only. Trader OS performs all calculations.</p>
          <Button type="button" kind="ghost" disabled={busy || !nl.trim()} onClick={() => void parseNl()}>
            Parse into calculator
          </Button>
        </Panel>
      )}

      <div className="grid">
        <Panel title="Calculation mode">
          <div className="modes">
            {MODES.filter((m) => (compact ? m.id === "fixed_risk_sl" || m.id === "risk_to_levels" || m.id === "trade_analysis" : true)).map(
              (m) => (
                <button
                  key={m.id}
                  type="button"
                  className={mode === m.id ? "mode on" : "mode"}
                  onClick={() => setMode(m.id)}
                >
                  <strong>{m.label}</strong>
                  <span className="muted">{m.hint}</span>
                </button>
              ),
            )}
          </div>
        </Panel>

        <Panel title="Trade inputs">
          <div className="fields">
            <Field label="Instrument">
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.display_symbol}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>
            <Field label="Entry">
              <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" />
            </Field>
            {showLot && (
              <Field label="Position size">
                <input value={lot} onChange={(e) => setLot(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {showSl && (
              <Field label={slOptional ? "Stop loss (optional)" : "Stop loss"}>
                <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {showTp && (
              <Field label="Take profit">
                <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {showRisk && (
              <Field label="Maximum risk ($)">
                <input value={risk} onChange={(e) => setRisk(e.target.value)} inputMode="decimal" />
              </Field>
            )}
            {showReward && (
              <Field label="Target reward ($)">
                <input value={reward} onChange={(e) => setReward(e.target.value)} inputMode="decimal" />
              </Field>
            )}
          </div>
          <label className="stale-opt">
            <input type="checkbox" checked={allowStale} onChange={(e) => setAllowStale(e.target.checked)} />
            Allow cached conversion rate if live quote is stale (labeled in results)
          </label>
          <Button type="button" disabled={busy || !accountId} onClick={() => void calculate()}>
            {busy ? "Calculating…" : "Calculate"}
          </Button>
        </Panel>
      </div>

      {calc?.ok && (
        <>
          <div className="grid meta">
            <Panel title="Market data">
              {result?.market ? (
                <div className="meta-grid">
                  <div>
                    <span className="lbl">Symbol</span>
                    <span className="val num">{result.market.symbol}</span>
                  </div>
                  <div>
                    <span className="lbl">Last</span>
                    <span className="val num">{result.market.last ?? "—"}</span>
                  </div>
                  <div>
                    <span className="lbl">Source</span>
                    <span className="val">{result.market.provider ?? "—"}</span>
                  </div>
                  <div>
                    <span className="lbl">Freshness</span>
                    <span className="val">{result.market.freshness ?? "—"}
                      {result.market.cached ? " · cached" : ""}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">Updated</span>
                    <span className="val">{result.market.timestamp ?? "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="muted">No market quote attached to this calculation.</p>
              )}
              {result?.market?.warning && <p className="muted tiny">{result.market.warning}</p>}
            </Panel>
            <Panel title="FX conversion">
              {result?.conversion ? (
                <div className="meta-grid">
                  <div>
                    <span className="lbl">Pair</span>
                    <span className="val">
                      {result.conversion.base ?? "—"} → {result.conversion.quote ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">Rate</span>
                    <span className="val num">{result.conversion.rate ?? "—"}</span>
                  </div>
                  <div>
                    <span className="lbl">Source</span>
                    <span className="val">{result.conversion.source ?? "—"}</span>
                  </div>
                  <div>
                    <span className="lbl">Status</span>
                    <span className="val">
                      {result.conversion.freshness ?? "—"}
                      {result.conversion.cached ? " · cached" : ""}
                      {result.conversion.assumed ? " · assumed peg" : ""}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">Updated</span>
                    <span className="val">{result.conversion.timestamp ?? "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="muted">No conversion metadata.</p>
              )}
              {result?.conversion?.reason && <p className="muted tiny">{result.conversion.reason}</p>}
            </Panel>
          </div>

          <div className="grid results">
            <Panel title="Calculated parameters">
              <div className="stats">
                <div>
                  <span className="lbl">Position size</span>
                  <span className="val num">
                    {calc.lot_size} {calc.size_unit}
                  </span>
                </div>
                <div>
                  <span className="lbl">Stop loss</span>
                  <span className="val num">{calc.stop_loss ?? "—"}</span>
                </div>
                <div>
                  <span className="lbl">Take profit</span>
                  <span className="val num">{calc.take_profit ?? "—"}</span>
                </div>
                <div>
                  <span className="lbl">Risk</span>
                  <span className="val num">{calc.risk_amount ? money(calc.risk_amount) : "—"}</span>
                </div>
                <div>
                  <span className="lbl">Potential reward</span>
                  <span className="val num">{calc.reward_amount ? money(calc.reward_amount) : "—"}</span>
                </div>
                <div>
                  <span className="lbl">R:R</span>
                  <span className="val num">{calc.planned_rr != null ? `1 : ${num(calc.planned_rr)}` : "—"}</span>
                </div>
                <div>
                  <span className="lbl">Risk %</span>
                  <span className="val num">{calc.risk_percent != null ? `${num(calc.risk_percent, 2)}%` : "—"}</span>
                </div>
                <div>
                  <span className="lbl">Stop / target (pips)</span>
                  <span className="val num">
                    {calc.stop_pips ?? "—"} / {calc.tp_pips ?? "—"}
                  </span>
                </div>
              </div>
              {calc.requested_risk != null && calc.risk_amount != null && (
                <p className="muted tiny">
                  Requested risk {money(calc.requested_risk)} · Calculated {money(calc.risk_amount)}
                  {calc.risk_difference != null ? ` · Difference ${money(calc.risk_difference)}` : ""}
                </p>
              )}
              {calc.notes.length > 0 && (
                <ul className="notes">
                  {calc.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </Panel>

            {policy && (
              <Panel title="Risk status">
                <div className={`status ${policy.status}`}>
                  <span className="dot" />
                  {policy.headline}
                </div>
                <ul className="notes">
                  {policy.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <div className="impact">
                  <h3>Account</h3>
                  <p>
                    Balance {money(policy.account.balance)} · Equity {money(policy.account.equity)}
                  </p>
                  <h3>Account impact</h3>
                  <p>
                    Daily risk used {money(policy.account_impact.daily_risk_used)} /{" "}
                    {money(policy.account_impact.daily_risk_budget)} · Remaining{" "}
                    {money(policy.account_impact.daily_risk_remaining)}
                  </p>
                  <p>Max DD remaining (personal) {money(policy.account_impact.max_dd_remaining_personal)}</p>
                </div>
                {policy.status === "red" && (
                  <p className="muted tiny">Do not override a RED status. Adjust inputs to fit policy.</p>
                )}
              </Panel>
            )}
          </div>

          <Panel title="Trade plan">
            <div className="actions">
              {onApply ? (
                <Button type="button" disabled={policy?.status === "red"} onClick={useValues}>
                  Use these values
                </Button>
              ) : (
                <Button type="button" disabled={policy?.status === "red"} onClick={addToTradePlan}>
                  Add to Trade Plan
                </Button>
              )}
              {!compact && (
                <Button type="button" kind="ghost" disabled={busy} onClick={() => void runExplain()}>
                  Explain calculation
                </Button>
              )}
              {!compact && (
                <Link href="/trades/new" className="linkish">
                  Open New Trade
                </Link>
              )}
            </div>
            <p className="muted tiny">Does not create a journal entry. Review and save on New Trade.</p>
            {explain && <p className="explain">{explain}</p>}
          </Panel>
        </>
      )}

      <style jsx>{`
        .calc {
          display: grid;
          gap: 14px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }
        .acct {
          text-align: right;
          font-size: 13px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .meta-grid {
          display: grid;
          gap: 10px;
        }
        .stale-opt {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 13px;
          margin: 0 0 12px;
          color: var(--text-secondary);
        }
        .modes {
          display: grid;
          gap: 8px;
        }
        .mode {
          text-align: left;
          display: grid;
          gap: 2px;
          padding: 10px 12px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }
        .mode.on {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
        }
        .mode strong {
          font-size: 14px;
        }
        .mode span {
          font-size: 12px;
        }
        .fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 16px;
        }
        .lbl {
          display: block;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .val {
          font-size: 20px;
          font-weight: 600;
        }
        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--text-secondary);
        }
        .status.green .dot {
          background: var(--accent);
        }
        .status.yellow .dot {
          background: #c9a227;
        }
        .status.red .dot {
          background: #c44;
        }
        .notes {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
        }
        .impact h3 {
          margin: 12px 0 4px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .impact p {
          margin: 0 0 4px;
          font-size: 13px;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }
        .tiny {
          font-size: 12px;
        }
        .explain {
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.45;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }
        .linkish {
          color: var(--accent);
          font-weight: 600;
          font-size: 14px;
        }
        .compact .grid {
          grid-template-columns: 1fr;
        }
        @media (max-width: 900px) {
          .grid,
          .fields,
          .stats {
            grid-template-columns: 1fr;
          }
          .head {
            flex-direction: column;
          }
          .acct {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
