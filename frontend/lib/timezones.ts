const FALLBACK = [
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "UTC",
];

export function listTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  return FALLBACK;
}

export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}

export function timezoneCity(id: string): string {
  const parts = id.split("/");
  const tail = parts.slice(1).join(" / ") || parts[0] || id;
  return tail.replace(/_/g, " ");
}

export function timezoneRegion(id: string): string {
  const region = id.split("/")[0] ?? "Other";
  if (region === "Etc" || region === "UTC") return "UTC";
  return region;
}

export function timezoneOffset(id: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return part ?? "";
  } catch {
    return "";
  }
}

export function timezoneOptionLabel(id: string): string {
  const city = timezoneCity(id);
  const offset = timezoneOffset(id);
  return offset ? `${city} (${offset})` : city;
}

export function formatInTimezone(id: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: id,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(at);
  } catch {
    return "";
  }
}

export function groupedTimezones(extra?: string): { region: string; zones: string[] }[] {
  const set = new Set(listTimezones());
  if (extra) set.add(extra);
  const groups = new Map<string, string[]>();
  for (const id of [...set].sort((a, b) => a.localeCompare(b))) {
    const region = timezoneRegion(id);
    const list = groups.get(region) ?? [];
    list.push(id);
    groups.set(region, list);
  }
  const order = ["Africa", "America", "Europe", "Asia", "Australia", "Pacific", "UTC"];
  return [...groups.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
    })
    .map(([region, zones]) => ({ region, zones }));
}
