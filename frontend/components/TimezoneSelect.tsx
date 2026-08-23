"use client";

import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui";
import {
  formatInTimezone,
  groupedTimezones,
  timezoneOptionLabel,
} from "@/lib/timezones";

export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const groups = useMemo(() => groupedTimezones(value), [value]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = formatInTimezone(value, now);

  return (
    <div className="tz">
      <Field label="Timezone">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {groups.map((group) => (
            <optgroup key={group.region} label={group.region}>
              {group.zones.map((id) => (
                <option key={id} value={id}>
                  {timezoneOptionLabel(id)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {clock ? <p className="clock">Local time now: {clock}</p> : null}
      <style jsx>{`
        .tz {
          display: grid;
          gap: 6px;
        }
        .clock {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
