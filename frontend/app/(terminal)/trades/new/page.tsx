"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import type { ChecklistTemplate, Instrument, Setup, Trade, TradePreview } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { money, num } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { PreTradeCheck, processCheckStatus } from "@/components/PreTradeCheck";

const EMOTIONS = ["calm", "confident", "fearful", "fomo", "frustrated", "revenge", "bored", "neutral", "anxious", "euphoric"];

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewTradePage() {
  const router = useRouter();
  const [setups, setSetups] = useState<Setup[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [symbol, setSymbol] = useState("EURUSD");
  const [direction, setDirection] = useState("long");
  const [timeframe, setTimeframe] = useState("M15");
  const [setupId, setSetupId] = useState("");
  const [when, setWhen] = useState("");
  const [exitWhen, setExitWhen] = useState("");
  const [entry, setEntry] = useState("1.08500");
  const [sl, setSl] = useState("1.08400");
  const [tp, setTp] = useState("1.08700");
  const [lot, setLot] = useState("0.05");
  const [exit, setExit] = useState("");
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [setupValid, setSetupValid] = useState(true);
  const [rulesFollowed, setRulesFollowed] = useState(true);
  const [emotional, setEmotional] = useState(false);
  const [mistake, setMistake] = useState(false);
  const [notes, setNotes] = useState("");
  const [emotionBefore, setEmotionBefore] = useState("calm");
  const [emotionDuring, setEmotionDuring] = useState("calm");
  const [emotionAfter, setEmotionAfter] = useState("neutral");
  const [fomo, setFomo] = useState(0);
  const [fear, setFear] = useState(0);
  const [frustration, setFrustration] = useState(0);
  const [revenge, setRevenge] = useState(0);
  const [confidence, setConfidence] = useState(6);
  const [ack, setAck] = useState(false);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [exitFile, setExitFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmNeeded, setConfirmNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccountId(getActiveAccountId());
    setWhen(nowLocalInput());
    setReady(true);
    const on = () => setAccountId(getActiveAccountId());
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, []);

  useEffect(() => {
    void (async () => {
      const [s, inst] = await Promise.all([
        api<Setup[]>("/api/setups"),
        api<{ instruments: Instrument[] }>("/api/instruments"),
      ]);
      const active = s.filter((x) => x.active);
      setSetups(active);
      setInstruments(inst.instruments);
      setSetupId(active[0]?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!setupId) return;
    void (async () => {
      const c = await api<ChecklistTemplate>(
        `/api/checklists?setup_id=${encodeURIComponent(setupId)}&instrument=${encodeURIComponent(symbol)}`,
      );
      setChecklist(c);
    })();
  }, [setupId, symbol]);

  useEffect(() => {
    setChecked({});
  }, [setupId]);

  const payload = useMemo(
    () => ({
      account_id: accountId,
      symbol,
      direction,
      entry_price: entry,
      stop_loss: sl,
      take_profit: tp || null,
      lot_size: lot,
      trade_timestamp: when ? new Date(when).toISOString() : null,
    }),
    [accountId, symbol, direction, entry, sl, tp, lot, when],
  );

  useEffect(() => {
    if (!accountId) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const p = await api<TradePreview>("/api/trades/preview", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setPreview(p);
        } catch {
          setPreview(null);
        }
      })();
    }, 180);
    return () => clearTimeout(t);
  }, [payload, accountId]);

  const checkStatus = processCheckStatus(
    preview?.process_status,
    preview?.policy,
    checklist?.items ?? [],
    checked,
  );
  const hardBlocked = checkStatus === "blocked";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Select an account first.");
      return;
    }
    setBusy(true);
    setError(null);
    setConfirmNeeded(false);
    try {
      const body = {
        account_id: accountId,
        symbol,
        direction,
        trade_timestamp: new Date(when).toISOString(),
        exit_timestamp: exitWhen ? new Date(exitWhen).toISOString() : null,
        setup_id: setupId || null,
        timeframe,
        entry_price: entry,
        exit_price: exit || null,
        stop_loss: sl,
        take_profit: tp || null,
        lot_size: lot,
        setup_valid: setupValid,
        rules_followed: rulesFollowed,
        emotional_trade: emotional,
        mistake,
        notes,
        acknowledged_warnings: ack,
        psychology: {
          emotion_before: emotionBefore,
          emotion_during: emotionDuring,
          emotion_after: emotionAfter,
          emotional_intensity: Math.max(fomo, fear, frustration, revenge, 3),
          confidence,
          fear,
          fomo,
          frustration,
          revenge,
          boredom: 0,
        },
        checklist: (checklist?.items ?? [])
          .filter((item) => item.kind !== "automatic")
          .map((item) => ({
            item_id: item.id,
            checked: Boolean(checked[item.id]),
          })),
      };
      const trade = await api<Trade>("/api/trades", { method: "POST", body: JSON.stringify(body) });
      if (entryFile) {
        const fd = new FormData();
        fd.append("file", entryFile);
        fd.append("type", "entry");
        await api(`/api/trades/${trade.id}/screenshots`, { method: "POST", body: fd });
      }
      if (exitFile) {
        const fd = new FormData();
        fd.append("file", exitFile);
        fd.append("type", "exit");
        await api(`/api/trades/${trade.id}/screenshots`, { method: "POST", body: fd });
      }
      router.push(`/trades/${trade.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.body as { detail?: { code?: string; message?: string } | string };
        const obj = typeof detail?.detail === "object" ? detail.detail : null;
        if (obj?.code === "policy_confirmation_required") {
          setConfirmNeeded(true);
          setError(obj.message ?? "Policy warning. Confirm to journal anyway.");
        } else if (obj?.code === "policy_blocked") {
          setError(obj.message ?? "Blocked by account policy.");
        } else {
          setError(obj?.message ?? (typeof detail?.detail === "string" ? detail.detail : err.message));
        }
      } else {
        setError("Unable to save trade.");
      }
    } finally {
      setBusy(false);
    }
  }

  const riskTone =
    hardBlocked || preview?.process_status === "blocked"
      ? "danger"
      : preview?.process_status === "warning" || preview?.policy?.requires_confirmation
        ? "warn"
        : preview
          ? "ok"
          : "";
  const riskCopy =
    hardBlocked || preview?.process_status === "blocked"
      ? "Trade exceeds configured risk policy"
      : preview?.process_status === "warning" || preview?.policy?.requires_confirmation
        ? "Risk approaching personal limit"
        : preview
          ? "Risk within account policy"
          : "Enter execution details to calculate risk";

  return (
    <div className="new-trade">
      <p className="page-kicker">Workspace</p>
      <h1>New trade</h1>
      <p className="muted">Risk, R:R and session are calculated on the server. This is a journal, not a signal.</p>
      {ready && !accountId && <Alert kind="warn">Create or select an account before journaling.</Alert>}
      {error && <Alert kind={confirmNeeded ? "warn" : "danger"}>{error}</Alert>}
      {hardBlocked && preview?.policy?.block_reason && (
        <Alert kind="danger">{preview.policy.block_reason}</Alert>
      )}
      {preview?.warnings.filter((w) => !preview.policy?.block_reason || w !== preview.policy.block_reason).map((w) => (
        <Alert key={w} kind="warn">
          {w}
        </Alert>
      ))}
      <form onSubmit={submit}>
        <div className={`risk-banner ${riskTone}`} role="status">
          <strong>{riskCopy}</strong>
          {preview && (
            <span className="num">
              {money(preview.risk_amount)} · {num(preview.risk_percent, 2)}% · R:R {preview.planned_rr ?? "-"}
            </span>
          )}
        </div>
        <div className="cols">
          <Panel title="1. Trade setup">
            <div className="grid2">
              <Field label="Instrument">
                <select value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}>
                  {instruments.map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.symbol}
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
              <Field label="Entry time (local)">
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </Field>
              <Field label="Exit time">
                <input type="datetime-local" value={exitWhen} onChange={(e) => setExitWhen(e.target.value)} />
              </Field>
              <Field label="Setup">
                <select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Timeframe">
                <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                  {["M1", "M5", "M15", "M30", "H1", "H4", "D1"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>
          <Panel title="2. Execution">
            <div className="grid2">
              <Field label="Entry">
                <input className="num" value={entry} onChange={(e) => setEntry(e.target.value)} />
              </Field>
              <Field label="Stop-loss">
                <input className="num" value={sl} onChange={(e) => setSl(e.target.value)} />
              </Field>
              <Field label="Take-profit">
                <input className="num" value={tp} onChange={(e) => setTp(e.target.value)} />
              </Field>
              <Field label="Lot size">
                <input className="num" value={lot} onChange={(e) => setLot(e.target.value)} />
              </Field>
              <Field label="Exit (optional)">
                <input className="num" value={exit} onChange={(e) => setExit(e.target.value)} />
              </Field>
            </div>
            {preview && (
              <dl className="metrics">
                <div>
                  <dt>Stop</dt>
                  <dd className="num">{num(preview.stop_pips, 1)} pips</dd>
                </div>
                <div>
                  <dt>TP</dt>
                  <dd className="num">{preview.tp_pips ? `${num(preview.tp_pips, 1)} pips` : "-"}</dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd className="num">{money(preview.risk_amount)}</dd>
                </div>
                <div>
                  <dt>Risk %</dt>
                  <dd className="num">{num(preview.risk_percent, 2)}%</dd>
                </div>
                <div>
                  <dt>Planned R:R</dt>
                  <dd className="num">{preview.planned_rr ?? "-"}</dd>
                </div>
                <div>
                  <dt>Est. P/L at TP</dt>
                  <dd className="num">{money(preview.estimated_pnl_at_tp)}</dd>
                </div>
              </dl>
            )}
          </Panel>
        </div>

        <Panel title="3. Pre-trade process">
          <PreTradeCheck
            template={checklist}
            checked={checked}
            onToggle={(id, value) => setChecked((c) => ({ ...c, [id]: value }))}
            autoChecks={preview?.auto_checks ?? []}
            status={checkStatus}
          />
        </Panel>

        <div className="cols">
          <Panel title="5. Notes">
            <label>
              <input type="checkbox" checked={setupValid} onChange={(e) => setSetupValid(e.target.checked)} /> Setup valid
            </label>
            <label>
              <input type="checkbox" checked={rulesFollowed} onChange={(e) => setRulesFollowed(e.target.checked)} /> Rules followed
            </label>
            <label>
              <input type="checkbox" checked={emotional} onChange={(e) => setEmotional(e.target.checked)} /> Emotional trade
            </label>
            <label>
              <input type="checkbox" checked={mistake} onChange={(e) => setMistake(e.target.checked)} /> Mistake
            </label>
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Panel>
          <Panel title="4. Psychology">
            <div className="grid2">
              <Field label="Before">
                <select value={emotionBefore} onChange={(e) => setEmotionBefore(e.target.value)}>
                  {EMOTIONS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="During">
                <select value={emotionDuring} onChange={(e) => setEmotionDuring(e.target.value)}>
                  {EMOTIONS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="After">
                <select value={emotionAfter} onChange={(e) => setEmotionAfter(e.target.value)}>
                  {EMOTIONS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Confidence 0–10">
                <input type="number" min={0} max={10} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
              </Field>
              <Field label="FOMO">
                <input type="number" min={0} max={10} value={fomo} onChange={(e) => setFomo(Number(e.target.value))} />
              </Field>
              <Field label="Fear">
                <input type="number" min={0} max={10} value={fear} onChange={(e) => setFear(Number(e.target.value))} />
              </Field>
              <Field label="Frustration">
                <input type="number" min={0} max={10} value={frustration} onChange={(e) => setFrustration(Number(e.target.value))} />
              </Field>
              <Field label="Revenge">
                <input type="number" min={0} max={10} value={revenge} onChange={(e) => setRevenge(Number(e.target.value))} />
              </Field>
            </div>
          </Panel>
        </div>

        <Panel title="6. Screenshot">
          <div className="grid2">
            <Field label="Entry screenshot">
              <input type="file" accept="image/*" onChange={(e) => setEntryFile(e.target.files?.[0] ?? null)} />
            </Field>
            <Field label="Exit screenshot">
              <input type="file" accept="image/*" onChange={(e) => setExitFile(e.target.files?.[0] ?? null)} />
            </Field>
          </div>
        </Panel>

        {(confirmNeeded || preview?.policy?.requires_confirmation) && (
          <label>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I acknowledge the policy
            warning and still want to journal this trade.
          </label>
        )}

        <Button type="submit" disabled={busy || !accountId || hardBlocked}>
          {busy ? "Saving…" : hardBlocked ? "Blocked by risk policy" : "Save trade"}
        </Button>
      </form>
      <style jsx>{`
        .new-trade {
          --warning: var(--accent);
          --warning-bg: color-mix(in srgb, var(--accent) 18%, var(--surface));
          --amber: var(--accent);
          --amber-bg: color-mix(in srgb, var(--accent) 18%, var(--surface));
        }
        form {
          display: grid;
          gap: 14px;
        }
        .risk-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }
        .risk-banner.ok {
          background: var(--green-bg);
          border-color: transparent;
        }
        .risk-banner.warn {
          background: var(--amber-bg);
          border-color: transparent;
          box-shadow: inset 3px 0 0 var(--accent);
        }
        .risk-banner.danger {
          background: var(--red-bg);
          border-color: transparent;
        }
        .cols {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
        }
        .grid2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 14px 0 0;
        }
        .metrics dt {
          color: var(--muted);
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .metrics dd {
          margin: 0;
          font-size: 15px;
        }
        label {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        @media (max-width: 900px) {
          .cols,
          .grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
