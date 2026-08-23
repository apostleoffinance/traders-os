"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, setStoredUser } from "@/lib/api";
import type { ChecklistLibrary, ChecklistTemplate, User } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { TelegramMark, YouTubeMark } from "@/components/SocialMarks";
import { ChecklistBuilder, draftFromTemplate, type ChecklistDraftItem } from "@/components/ChecklistBuilder";
import { COMMUNITY } from "@/lib/community";
import {
  disableJournalReminders,
  enableJournalReminders,
  loadPushConfig,
  pushSupported,
} from "@/lib/push";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [library, setLibrary] = useState<ChecklistLibrary | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [items, setItems] = useState<ChecklistDraftItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderHour, setReminderHour] = useState(18);
  const [pushAvailable, setPushAvailable] = useState(false);

  function applyTemplate(lib: ChecklistLibrary, tmpl: ChecklistTemplate) {
    setTemplateId(tmpl.id);
    setItems(draftFromTemplate(lib, tmpl.items));
  }

  useEffect(() => {
    void (async () => {
      const me = await api<User>("/api/auth/me");
      setUser(me);
      setTimezone(me.timezone);
      const [lib, tmpls] = await Promise.all([
        api<ChecklistLibrary>("/api/checklists/library"),
        api<ChecklistTemplate[]>("/api/checklists/templates"),
      ]);
      setLibrary(lib);
      setTemplates(tmpls);
      const initial = tmpls.find((t) => t.is_default) ?? tmpls[0];
      if (initial) applyTemplate(lib, initial);
      try {
        const cfg = await loadPushConfig();
        setPushAvailable(cfg.available);
        setReminderHour(cfg.reminder_hour);
      } catch {
        setPushAvailable(false);
      }
    })();
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const me = await api<User>("/api/auth/me", { method: "PATCH", body: JSON.stringify({ timezone }) });
    setUser(me);
    setStoredUser(me);
    setSaved(true);
  }

  async function saveChecklist(e: FormEvent) {
    e.preventDefault();
    if (!templateId) return;
    setBusy(true);
    try {
      const payload = items
        .filter((x) => x.included && x.label.trim())
        .map((item, i) => ({
          label: item.label.trim(),
          sort_order: i,
          required: item.required,
          category: item.category,
          kind: item.kind,
          auto_key: item.auto_key,
          description: item.description,
        }));
      const updated = await api<ChecklistTemplate>(`/api/checklists/templates/${templateId}`, {
        method: "PUT",
        body: JSON.stringify({ items: payload }),
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (library) setItems(draftFromTemplate(library, updated.items));
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminders(on: boolean) {
    setRemindersBusy(true);
    setReminderError(null);
    try {
      if (on) {
        await enableJournalReminders();
        setUser((u) => (u ? { ...u, reminders_enabled: true } : u));
      } else {
        await disableJournalReminders();
        setUser((u) => (u ? { ...u, reminders_enabled: false } : u));
      }
      setSaved(true);
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "Could not update reminders.");
    } finally {
      setRemindersBusy(false);
    }
  }

  function switchTemplate(id: string) {
    if (!library) return;
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) applyTemplate(library, tmpl);
  }

  if (!user || !library) return <p className="muted">Loading…</p>;

  const current = templates.find((t) => t.id === templateId);

  return (
    <div>
      <p className="page-kicker">Account</p>
      <h1>Settings</h1>
      {saved && <Alert kind="info">Saved. The selected template is what New trade loads for that setup.</Alert>}
      <div className="cols">
        <div className="left">
        <Panel title="Appearance">
          <p className="muted">Dark is the default. Use the toggle to switch to light.</p>
          <ThemeToggle />
        </Panel>
        <Panel title="Community">
          <p className="muted">Telegram and YouTube. No signals.</p>
          <p>
            <a href={COMMUNITY.telegram.href} target="_blank" rel="noreferrer" className="community-link">
              <TelegramMark size={18} /> Telegram
            </a>
          </p>
          <p>
            <a href={COMMUNITY.youtube.href} target="_blank" rel="noreferrer" className="community-link">
              <YouTubeMark size={18} /> YouTube
            </a>
          </p>
        </Panel>
        <Panel title="Display">
          <form onSubmit={saveProfile}>
            <TimezoneSelect value={timezone} onChange={setTimezone} />
            <p className="muted">
              Daily loss windows, journal reminders and local clocks use this zone. Market session labels stay London,
              New York and Tokyo.
            </p>
            <Button type="submit">Save timezone</Button>
          </form>
        </Panel>
        <Panel title="Journal reminders">
          <p className="muted">
            Optional browser notification, once per day around {reminderHour}:00 in your timezone, only if you have not
            journaled that day. Not a trading signal.
          </p>
          {!pushSupported() && (
            <Alert kind="warn">This browser does not support web notifications.</Alert>
          )}
          {typeof Notification !== "undefined" && Notification.permission === "denied" && (
            <Alert kind="warn">Notifications are blocked in the browser. Enable them in site settings, then try again.</Alert>
          )}
          {!pushAvailable && pushSupported() && (
            <Alert kind="warn">Reminders are not configured on the server yet (VAPID keys).</Alert>
          )}
          {reminderError && <Alert kind="danger">{reminderError}</Alert>}
          <label className="toggle">
            <input
              type="checkbox"
              checked={Boolean(user.reminders_enabled)}
              disabled={remindersBusy || !pushSupported() || !pushAvailable}
              onChange={(e) => void toggleReminders(e.target.checked)}
            />
            Notify me if I have not journaled today
          </label>
        </Panel>
        </div>
        <Panel title="Pre-trade check">
          <Field label="Template">
            <select value={templateId} onChange={(e) => switchTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.is_default ? "Default (any setup)" : t.name}
                  {t.instrument ? ` · ${t.instrument}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {current?.description && <p className="muted">{current.description}</p>}
          <ChecklistBuilder
            items={items}
            categories={library.categories}
            onChange={setItems}
            onSave={saveChecklist}
            busy={busy}
          />
        </Panel>
      </div>
      <style jsx>{`
        .cols {
          display: grid;
          grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
          gap: 14px;
          align-items: start;
        }
        .cols > :global(*) {
          min-width: 0;
          position: relative;
          z-index: 0;
        }
        form {
          display: grid;
          gap: 10px;
        }
        .left {
          display: grid;
          gap: 14px;
        }
        .toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }
        .community-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: underline;
        }
        @media (max-width: 800px) {
          .cols {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
