"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, getActiveAccountId } from "@/lib/api";
import type { ChecklistTemplate, Instrument, Setup, Trade, TradePreview } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { money, num } from "@/lib/format";
import { PreTradeCheck, processCheckStatus } from "@/components/PreTradeCheck";

const EMOTIONS = [
  "calm",
  "confident",
  "fearful",
  "fomo",
  "frustrated",
  "revenge",
  "bored",
  "neutral",
  "anxious",
  "euphoric",
];

export type TradeFormMode = "create" | "edit" | "close";

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  mode: TradeFormMode;
  trade?: Trade | null;
};

export function TradeForm({ mode, trade = null }: Props) {
  const router = useRouter();
  const isClose = mode === "close";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  const [setups, setSetups] = useState<Setup[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [symbol, setSymbol] = useState(trade?.symbol ?? "EURUSD");
  const [direction, setDirection] = useState(trade?.direction ?? "long");
  const [timeframe, setTimeframe] = useState(trade?.timeframe ?? "M15");
  const [setupId, setSetupId] = useState(trade?.setup_id ?? "");
  const [when, setWhen] = useState(trade ? toLocalInput(trade.trade_timestamp) : "");
  const [exitWhen, setExitWhen] = useState(trade ? toLocalInput(trade.exit_timestamp) : "");
  const [entry, setEntry] = useState(trade?.entry_price ?? "1.08500");
  const [sl, setSl] = useState(trade?.stop_loss ?? "1.08400");
  const [tp, setTp] = useState(trade?.take_profit ?? "1.08700");
  const [lot, setLot] = useState(trade?.lot_size ?? "0.05");
  const [exit, setExit] = useState(trade?.exit_price ?? "");
  const [recordClosed, setRecordClosed] = useState(Boolean(trade?.exit_price) && isCreate);
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [setupValid, setSetupValid] = useState(trade?.setup_valid ?? true);
  const [rulesFollowed, setRulesFollowed] = useState(trade?.rules_followed ?? true);
  const [emotional, setEmotional] = useState(trade?.emotional_trade ?? false);
  const [mistake, setMistake] = useState(trade?.mistake ?? false);
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [emotionBefore, setEmotionBefore] = useState(trade?.psychology?.emotion_before ?? "calm");
  const [emotionDuring, setEmotionDuring] = useState(trade?.psychology?.emotion_during ?? "calm");
  const [emotionAfter, setEmotionAfter] = useState(trade?.psychology?.emotion_after ?? "neutral");
  const [fomo, setFomo] = useState(trade?.psychology?.fomo ?? 0);
  const [fear, setFear] = useState(trade?.psychology?.fear ?? 0);
  const [frustration, setFrustration] = useState(trade?.psychology?.frustration ?? 0);
  const [revenge, setRevenge] = useState(trade?.psychology?.revenge ?? 0);
  const [confidence, setConfidence] = useState(trade?.psychology?.confidence ?? 6);
  const [ack, setAck] = useState(false);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [exitFile, setExitFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmNeeded, setConfirmNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(trade?.account_id ?? null);
  const [ready, setReady] = useState(false);

  const showExit = isClose || isEdit || recordClosed;
  const showPostTrade = isClose || isEdit || recordClosed;
  const lockInitial = isClose;

  useEffect(() => {
    if (!isCreate) {
      setReady(true);
      return;
    }
    setAccountId(getActiveAccountId());
    setWhen(nowLocalInput());
    setReady(true);
    const on = () => setAccountId(getActiveAccountId());
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, [isCreate]);

  useEffect(() => {
    if (isClose && !exitWhen) setExitWhen(nowLocalInput());
  }, [isClose, exitWhen]);

  useEffect(() => {
    void (async () => {
      const [s, inst] = await Promise.all([
        api<Setup[]>("/api/setups"),
        api<{ instruments: Instrument[] }>("/api/instruments"),
      ]);
      const active = s.filter((x) => x.active);
      setSetups(active);
      setInstruments(inst.instruments);
      if (!setupId) setSetupId(trade?.setup_id ?? active[0]?.id ?? "");
    })();
  }, [setupId, trade?.setup_id]);

  useEffect(() => {
    if (!setupId) return;
    void (async () => {
      const c = await api<ChecklistTemplate>(
        `/api/checklists?setup_id=${encodeURIComponent(setupId)}&instrument=${encodeURIComponent(symbol)}`,
      );
      setChecklist(c);
      if (trade?.checklist?.length) {
        const next: Record<string, boolean> = {};
        for (const row of trade.checklist) next[row.item_id] = row.checked;
        setChecked(next);
      }
    })();
  }, [setupId, symbol, trade?.checklist]);

  const previewPayload = useMemo(
    () => ({
      account_id: accountId,
      symbol,
      direction,
      entry_price: entry,
      stop_loss: sl,
      take_profit: tp || null,
      lot_size: lot,
      exit_price: showExit && exit ? exit : null,
      trade_timestamp: when ? new Date(when).toISOString() : null,
    }),
    [accountId, symbol, direction, entry, sl, tp, lot, when, exit, showExit],
  );

  useEffect(() => {
    if (!accountId || lockInitial) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const p = await api<TradePreview>("/api/trades/preview", {
            method: "POST",
            body: JSON.stringify(previewPayload),
          });
          setPreview(p);
        } catch {
          setPreview(null);
        }
      })();
    }, 180);
    return () => clearTimeout(t);
  }, [previewPayload, accountId, lockInitial]);

  // Close mode: still preview realized figures when exit is set
  useEffect(() => {
    if (!isClose || !accountId || !exit) {
      if (isClose) setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const p = await api<TradePreview>("/api/trades/preview", {
            method: "POST",
            body: JSON.stringify({
              account_id: accountId,
              symbol,
              direction,
              entry_price: entry,
              stop_loss: sl,
              take_profit: tp || null,
              lot_size: lot,
              exit_price: exit,
              trade_timestamp: when ? new Date(when).toISOString() : null,
            }),
          });
          setPreview(p);
        } catch {
          setPreview(null);
        }
      })();
    }, 180);
    return () => clearTimeout(t);
  }, [isClose, accountId, exit, symbol, direction, entry, sl, tp, lot, when]);

  const checkStatus = processCheckStatus(
    preview?.process_status,
    preview?.policy,
    checklist?.items ?? [],
    checked,
  );
  const hardBlocked = !isClose && checkStatus === "blocked";

  async function uploadShots(tradeId: string) {
    if (entryFile) {
      const fd = new FormData();
      fd.append("file", entryFile);
      fd.append("type", "entry");
      await api(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: fd });
    }
    if (exitFile) {
      const fd = new FormData();
      fd.append("file", exitFile);
      fd.append("type", "exit");
      await api(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: fd });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Select an account first.");
      return;
    }
    if ((isClose || recordClosed) && !exit) {
      setError("Exit price is required to close the trade.");
      return;
    }
    setBusy(true);
    setError(null);
    setConfirmNeeded(false);
    try {
      const psychology = {
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
      };
      const checklistPayload = (checklist?.items ?? [])
        .filter((item) => item.kind !== "automatic")
        .map((item) => ({
          item_id: item.id,
          checked: Boolean(checked[item.id]),
        }));

      let saved: Trade;
      if (isClose && trade) {
        saved = await api<Trade>(`/api/trades/${trade.id}/close`, {
          method: "POST",
          body: JSON.stringify({
            exit_price: exit,
            exit_timestamp: exitWhen ? new Date(exitWhen).toISOString() : new Date().toISOString(),
            notes: notes || null,
            setup_valid: setupValid,
            rules_followed: rulesFollowed,
            emotional_trade: emotional,
            mistake,
            psychology,
          }),
        });
      } else if (isEdit && trade) {
        saved = await api<Trade>(`/api/trades/${trade.id}`, {
          method: "PUT",
          body: JSON.stringify({
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
            psychology,
            checklist: checklistPayload,
            acknowledged_warnings: ack,
          }),
        });
      } else {
        saved = await api<Trade>("/api/trades", {
          method: "POST",
          body: JSON.stringify({
            account_id: accountId,
            symbol,
            direction,
            trade_timestamp: new Date(when).toISOString(),
            exit_timestamp: recordClosed && exitWhen ? new Date(exitWhen).toISOString() : null,
            setup_id: setupId || null,
            timeframe,
            entry_price: entry,
            exit_price: recordClosed && exit ? exit : null,
            stop_loss: sl,
            take_profit: tp || null,
            lot_size: lot,
            setup_valid: setupValid,
            rules_followed: rulesFollowed,
            emotional_trade: emotional,
            mistake,
            notes,
            acknowledged_warnings: ack,
            psychology,
            checklist: checklistPayload,
          }),
        });
      }

      await uploadShots(saved.id);
      router.push(`/trades/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.body as { detail?: { code?: string; message?: string } | string };
        const obj = typeof detail?.detail === "object" ? detail.detail : null;
        if (obj?.code === "policy_confirmation_required") {
          setConfirmNeeded(true);
          setError(obj.message ?? "Policy warning. Confirm to journal anyway.");
        } else if (obj?.code === "policy_blocked") {
          setError(obj.message ?? "Blocked by account policy.");
        } else if (obj?.code === "conflict") {
          setError(obj.message ?? err.message);
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

  const title = isClose ? "Close trade" : isEdit ? "Edit trade" : "New trade";
  const kicker = isClose ? "Exit & review" : isEdit ? "Update journal" : "Workspace";
  const submitLabel = isClose
    ? busy
      ? "Closing…"
      : "Save & close trade"
    : busy
      ? "Saving…"
      : hardBlocked
        ? "Blocked by risk policy"
        : isEdit
          ? "Save changes"
          : "Save trade";

  return (
    <div className="trade-form">
      <p className="page-kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="muted">
        {isClose
          ? "Enter exit details. Realized P/L and R are calculated by the risk engine, not by AI."
          : isEdit
            ? "Correct journal fields. Changing entry, exit, SL, TP or size recalculates risk and P/L."
            : "Save as an open trade while you are still in the market. Close it later when the position ends."}
      </p>
      {ready && !accountId && isCreate && (
        <Alert kind="warn">Create or select an account before journaling.</Alert>
      )}
      {error && <Alert kind={confirmNeeded ? "warn" : "danger"}>{error}</Alert>}
      {hardBlocked && preview?.policy?.block_reason && (
        <Alert kind="danger">{preview.policy.block_reason}</Alert>
      )}
      {preview?.warnings
        ?.filter((w) => !preview.policy?.block_reason || w !== preview.policy.block_reason)
        .map((w) => (
          <Alert key={w} kind="warn">
            {w}
          </Alert>
        ))}

      <form onSubmit={submit}>
        {!isClose && (
          <Panel title="Initial trade data">
            <div className="grid2">
              <Field label="Instrument">
                <select
                  value={symbol}
                  disabled={lockInitial}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                >
                  {instruments.map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.symbol}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Direction">
                <select value={direction} disabled={lockInitial} onChange={(e) => setDirection(e.target.value)}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </Field>
              <Field label="Entry time (local)">
                <input
                  type="datetime-local"
                  value={when}
                  disabled={lockInitial}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </Field>
              <Field label="Setup">
                <select value={setupId} disabled={lockInitial} onChange={(e) => setSetupId(e.target.value)}>
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Timeframe">
                <select value={timeframe} disabled={lockInitial} onChange={(e) => setTimeframe(e.target.value)}>
                  {["M1", "M5", "M15", "M30", "H1", "H4", "D1"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Entry">
                <input className="num" value={entry} disabled={lockInitial} onChange={(e) => setEntry(e.target.value)} />
              </Field>
              <Field label="Stop-loss">
                <input className="num" value={sl} disabled={lockInitial} onChange={(e) => setSl(e.target.value)} />
              </Field>
              <Field label="Take-profit">
                <input className="num" value={tp} disabled={lockInitial} onChange={(e) => setTp(e.target.value)} />
              </Field>
              <Field label="Lot size">
                <input className="num" value={lot} disabled={lockInitial} onChange={(e) => setLot(e.target.value)} />
              </Field>
            </div>
            {preview && !isClose && (
              <dl className="metrics">
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
              </dl>
            )}
          </Panel>
        )}

        {isClose && trade && (
          <Panel title="Open position">
            <p>
              {trade.symbol} {trade.direction.toUpperCase()} · {trade.lot_size} lot · entry{" "}
              <span className="num">{trade.entry_price}</span> · risk {money(trade.risk_amount)}
            </p>
          </Panel>
        )}

        {isCreate && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={recordClosed}
              onChange={(e) => setRecordClosed(e.target.checked)}
            />
            Record as closed trade (historical journal entry)
          </label>
        )}

        {showExit && (
          <Panel title={isClose ? "Close trade" : "Post-trade data"}>
            <div className="grid2">
              <Field label="Exit price">
                <input className="num" required={isClose || recordClosed} value={exit} onChange={(e) => setExit(e.target.value)} />
              </Field>
              <Field label="Exit time">
                <input type="datetime-local" value={exitWhen} onChange={(e) => setExitWhen(e.target.value)} />
              </Field>
            </div>
            {preview?.estimated_realized_pnl != null && (
              <dl className="metrics">
                <div>
                  <dt>Result</dt>
                  <dd>{(preview.estimated_result ?? "-").toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Realized P/L</dt>
                  <dd className="num">{money(preview.estimated_realized_pnl)}</dd>
                </div>
                <div>
                  <dt>Realized R</dt>
                  <dd className="num">
                    {preview.estimated_realized_r != null ? `${num(preview.estimated_realized_r)}R` : "-"}
                  </dd>
                </div>
              </dl>
            )}
            <p className="muted calc-note">P/L and R are calculated from entry, exit, direction and size.</p>
          </Panel>
        )}

        {!isClose && (
          <Panel title="Pre-trade process">
            <PreTradeCheck
              template={checklist}
              checked={checked}
              onToggle={(id, value) => setChecked((c) => ({ ...c, [id]: value }))}
              autoChecks={preview?.auto_checks ?? []}
              status={checkStatus}
            />
          </Panel>
        )}

        <div className="cols">
          <Panel title={showPostTrade ? "Review" : "Notes"}>
            {showPostTrade && (
              <>
                <label>
                  <input type="checkbox" checked={setupValid} onChange={(e) => setSetupValid(e.target.checked)} />{" "}
                  Setup valid
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={rulesFollowed}
                    onChange={(e) => setRulesFollowed(e.target.checked)}
                  />{" "}
                  Rules followed
                </label>
                <label>
                  <input type="checkbox" checked={emotional} onChange={(e) => setEmotional(e.target.checked)} />{" "}
                  Emotional trade
                </label>
                <label>
                  <input type="checkbox" checked={mistake} onChange={(e) => setMistake(e.target.checked)} /> Mistake
                </label>
              </>
            )}
            <Field label={isClose ? "Post-trade notes" : "Notes"}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Panel>
          <Panel title="Psychology">
            <div className="grid2">
              {!isClose && (
                <>
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
                </>
              )}
              {(showPostTrade || isClose) && (
                <Field label="After">
                  <select value={emotionAfter} onChange={(e) => setEmotionAfter(e.target.value)}>
                    {EMOTIONS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              )}
              {!isClose && (
                <>
                  <Field label="Confidence 0–10">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="FOMO">
                    <input type="number" min={0} max={10} value={fomo} onChange={(e) => setFomo(Number(e.target.value))} />
                  </Field>
                  <Field label="Fear">
                    <input type="number" min={0} max={10} value={fear} onChange={(e) => setFear(Number(e.target.value))} />
                  </Field>
                </>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="Screenshots">
          <div className="grid2">
            {!isClose && (
              <Field label="Entry screenshot">
                <input type="file" accept="image/*" onChange={(e) => setEntryFile(e.target.files?.[0] ?? null)} />
              </Field>
            )}
            {showExit && (
              <Field label="Exit screenshot (optional)">
                <input type="file" accept="image/*" onChange={(e) => setExitFile(e.target.files?.[0] ?? null)} />
              </Field>
            )}
          </div>
        </Panel>

        {(confirmNeeded || preview?.policy?.requires_confirmation) && !isClose && (
          <label>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I acknowledge the
            policy warning and still want to journal this trade.
          </label>
        )}

        <Button type="submit" disabled={busy || !accountId || hardBlocked}>
          {submitLabel}
        </Button>
      </form>
      <style jsx>{`
        .trade-form {
          --warning: var(--accent);
          --warning-bg: color-mix(in srgb, var(--accent) 18%, var(--surface));
          --amber: var(--accent);
          --amber-bg: color-mix(in srgb, var(--accent) 18%, var(--surface));
        }
        form {
          display: grid;
          gap: 14px;
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
        .calc-note {
          margin: 10px 0 0;
          font-size: 13px;
        }
        label,
        .toggle {
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
