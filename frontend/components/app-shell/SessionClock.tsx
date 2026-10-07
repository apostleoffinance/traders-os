"use client";

type SessionState = "OPEN" | "PRE" | "CLOSED";

type Desk = {
  code: string;
  timeZone: string;
  startMin: number;
  endMin: number;
};

const DESKS: Desk[] = [
  { code: "TKY", timeZone: "Asia/Tokyo", startMin: 9 * 60, endMin: 18 * 60 },
  { code: "LON", timeZone: "Europe/London", startMin: 8 * 60, endMin: 16 * 60 + 30 },
  { code: "NY", timeZone: "America/New_York", startMin: 8 * 60, endMin: 17 * 60 },
];

function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function sessionState(now: Date, desk: Desk): SessionState {
  const mins = localMinutes(now, desk.timeZone);
  if (mins >= desk.startMin && mins < desk.endMin) return "OPEN";
  const preStart = desk.startMin - 60;
  if (mins >= preStart && mins < desk.startMin) return "PRE";
  return "CLOSED";
}

export function SessionClock({ now = new Date() }: { now?: Date }) {
  return (
    <p className="session-clock" aria-label="Market sessions">
      {DESKS.map((desk, index) => {
        const state = sessionState(now, desk);
        return (
          <span key={desk.code}>
            {index > 0 ? " · " : null}
            <span className="code">{desk.code}</span>{" "}
            <span className={`state ${state.toLowerCase()}`}>{state}</span>
          </span>
        );
      })}
      <style jsx>{`
        .session-clock {
          margin: 0;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .code {
          color: var(--text-secondary);
        }
        .state.open {
          color: var(--pos);
        }
        .state.pre {
          color: var(--warning);
        }
        .state.closed {
          color: var(--text-muted);
        }
      `}</style>
    </p>
  );
}
