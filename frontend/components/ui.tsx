"use client";

import { cls } from "@/lib/format";

export function Panel({
  title,
  children,
  right,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      {(title || right) && (
        <header>
          <h2>{title}</h2>
          {right}
        </header>
      )}
      {children}
      <style jsx>{`
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
          gap: 12px;
        }
        h2 {
          margin: 0;
          font-size: 13.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
      `}</style>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "pos" | "neg" | "warn" | "ok" | "";
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={cls("num value", tone)}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
      <style jsx>{`
        .stat {
          min-width: 0;
        }
        .label {
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 4px;
          font-weight: 600;
        }
        .value {
          font-size: 22px;
          font-weight: 600;
        }
        .hint {
          margin-top: 2px;
          font-size: 13px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const s = status.toLowerCase();
  return (
    <span className={cls("badge", s)}>
      {status.toUpperCase()}
      <style jsx>{`
        .badge {
          display: inline-block;
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 4px 9px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
        }
        .green,
        .ok,
        .win {
          background: var(--green-bg);
          color: var(--success);
          border-color: transparent;
        }
        .yellow,
        .warn {
          background: var(--amber-bg);
          color: var(--warning);
          border-color: transparent;
        }
        .red,
        .loss,
        .danger {
          background: var(--red-bg);
          color: var(--danger);
          border-color: transparent;
        }
        .open {
          background: color-mix(in srgb, var(--accent) 18%, var(--surface));
          color: var(--accent);
          border-color: transparent;
        }
        .closed,
        .breakeven {
          background: var(--surface-2);
          color: var(--text);
        }
      `}</style>
    </span>
  );
}

export function Button({
  children,
  type = "button",
  onClick,
  kind = "primary",
  disabled,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls("btn", kind)}>
      {children}
      <style jsx>{`
        .btn {
          border: 1px solid var(--accent);
          background: var(--accent);
          color: var(--accent-contrast);
          padding: 8px 14px;
          letter-spacing: 0.04em;
          border-radius: var(--radius-sm);
          font-weight: 600;
        }
        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ghost {
          background: transparent;
          color: var(--text-primary);
          border-color: var(--line-strong);
        }
        .danger {
          background: transparent;
          border-color: var(--danger);
          color: var(--danger);
        }
      `}</style>
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      <style jsx>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 15px;
        }
        span {
          color: var(--text-secondary);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 12.5px;
          font-weight: 600;
        }
        .field :global(input),
        .field :global(select),
        .field :global(textarea) {
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 8px 10px;
          border-radius: var(--radius-sm);
        }
        .field :global(textarea) {
          min-height: 80px;
          resize: vertical;
        }
      `}</style>
    </label>
  );
}

export function Alert({ kind, children }: { kind: "warn" | "danger" | "info"; children: React.ReactNode }) {
  return (
    <div className={cls("alert", kind)}>
      {children}
      <style jsx>{`
        .alert {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .warn {
          background: var(--amber-bg);
          border-color: transparent;
          color: var(--text-primary);
        }
        .danger {
          background: var(--red-bg);
          border-color: transparent;
          color: var(--text-primary);
        }
        .info {
          background: var(--info-bg);
          border-color: transparent;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

export function LimitBar({
  label,
  limit,
  remaining,
  used,
}: {
  label: string;
  limit: string;
  remaining?: string;
  used?: string;
}) {
  const cap = Number(limit);
  const left = remaining != null ? Number(remaining) : NaN;
  const spent = used != null ? Number(used) : cap - left;
  const usedPct = cap > 0 && !Number.isNaN(spent) ? Math.max(0, Math.min(100, (spent / cap) * 100)) : 0;
  let t: "ok" | "warn" | "neg" | "" = "";
  if (cap && !Number.isNaN(spent)) {
    if (spent >= cap) t = "neg";
    else if (usedPct >= 70) t = "warn";
    else t = "ok";
  }
  const remainingLabel = remaining != null && !Number.isNaN(left) ? remaining : String(Math.max(0, cap - spent));
  return (
    <div className="limit">
      <div className="limit-row">
        <span>{label}</span>
        <span className={`num ${t}`}>
          {used != null || remaining != null
            ? `${formatMoneyish(spent)} / ${formatMoneyish(cap)} used`
            : formatMoneyish(cap)}
        </span>
      </div>
      <div className="track" aria-hidden>
        <div className={`fill ${t}`} style={{ width: `${usedPct}%` }} />
      </div>
      {remaining != null && (
        <div className="remain muted">
          {formatMoneyish(remainingLabel)} remaining of {formatMoneyish(cap)} limit
        </div>
      )}
      <style jsx>{`
        .limit {
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .limit:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .limit-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
          font-size: 15px;
          font-weight: 600;
        }
        .track {
          height: 5px;
          background: var(--surface-2);
          border-radius: 2px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: var(--success);
        }
        .fill.warn {
          background: var(--warning);
        }
        .fill.neg {
          background: var(--danger);
        }
        .remain {
          margin-top: 4px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function formatMoneyish(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
      {action}
      <style jsx>{`
        .empty {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-start;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px 16px;
        }
        strong {
          font-size: 17px;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
