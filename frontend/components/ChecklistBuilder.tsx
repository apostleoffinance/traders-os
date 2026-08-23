"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import type { ChecklistItem, ChecklistLibrary } from "@/lib/types";

const CATEGORY_ORDER = ["market_context", "setup_confirmation", "risk", "psychology", "execution"];

export type ChecklistDraftItem = {
  key: string;
  label: string;
  category: string;
  kind: "manual" | "automatic";
  auto_key: string | null;
  required: boolean;
  included: boolean;
  description: string | null;
};

export function draftFromTemplate(
  library: ChecklistLibrary,
  saved: ChecklistItem[],
): ChecklistDraftItem[] {
  const savedAutos = new Set(saved.filter((i) => i.kind === "automatic" && i.auto_key).map((i) => i.auto_key as string));
  const autos: ChecklistDraftItem[] = library.auto_items.map((spec) => ({
    key: `auto:${spec.auto_key}`,
    label: spec.label,
    category: spec.category,
    kind: "automatic",
    auto_key: spec.auto_key,
    required: spec.required,
    included: savedAutos.has(spec.auto_key ?? "") || saved.length === 0,
    description: spec.description,
  }));
  const manuals: ChecklistDraftItem[] = saved
    .filter((i) => i.kind !== "automatic")
    .map((item, i) => ({
      key: `manual:${item.id}:${i}`,
      label: item.label,
      category: item.category,
      kind: "manual",
      auto_key: null,
      required: item.required,
      included: true,
      description: item.description,
    }));
  return [...autos, ...manuals];
}

export function ChecklistBuilder({
  items,
  categories,
  onChange,
  onSave,
  busy,
}: {
  items: ChecklistDraftItem[];
  categories: { key: string; label: string }[];
  onChange: (items: ChecklistDraftItem[]) => void;
  onSave: (e: FormEvent) => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("setup_confirmation");
  const included = useMemo(() => items.filter((i) => i.included && i.label.trim()).length, [items]);
  const catLabel = useMemo(() => Object.fromEntries(categories.map((c) => [c.key, c.label])), [categories]);

  function patch(key: string, update: Partial<ChecklistDraftItem>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...update } : item)));
  }

  function addCustom() {
    const label = draft.trim();
    if (!label) return;
    onChange([
      ...items,
      {
        key: `custom:${Date.now()}`,
        label,
        category,
        kind: "manual",
        auto_key: null,
        required: false,
        included: true,
        description: null,
      },
    ]);
    setDraft("");
  }

  return (
    <form onSubmit={onSave}>
      <p className="muted">
        Automatic checks are calculated by the risk and session engines. Tick only the subjective conditions you want
        on New trade. These record process review, not whether the trade will win.
      </p>
      {CATEGORY_ORDER.map((cat) => {
        const rows = items.filter((i) => i.category === cat);
        if (!rows.length) return null;
        return (
          <section key={cat} className="cat">
            <h3>{catLabel[cat] ?? cat}</h3>
            <ul className="list">
              {rows.map((item) =>
                item.kind === "automatic" ? (
                  <li key={item.key} className={item.included ? "row" : "row off"}>
                    <label className="row-hit">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => patch(item.key, { included: !item.included })}
                      />
                      <span className="auto-label">
                        {item.label}
                        <em>automatic</em>
                      </span>
                    </label>
                  </li>
                ) : (
                  <li key={item.key} className={item.included ? "row" : "row off"}>
                    <label className="tick">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => patch(item.key, { included: !item.included })}
                      />
                    </label>
                    <input
                      className="label-input"
                      value={item.label}
                      onChange={(e) => patch(item.key, { label: e.target.value })}
                      aria-label="Checklist item"
                    />
                    <label className="req">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={() => patch(item.key, { required: !item.required })}
                      />
                      req
                    </label>
                    <button type="button" className="remove" onClick={() => onChange(items.filter((i) => i.key !== item.key))}>
                      Remove
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
      <div className="add">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a process check"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" kind="ghost" onClick={addCustom}>
          Add
        </Button>
      </div>
      <div className="foot">
        <p className="muted">
          {included} item{included === 1 ? "" : "s"} will appear on New trade.
        </p>
        <Button type="submit" disabled={busy || included === 0}>
          {busy ? "Saving…" : "Save checklist"}
        </Button>
      </div>
      <style jsx>{`
        form {
          display: grid;
          gap: 12px;
        }
        h3 {
          margin: 0 0 6px;
          font-size: 10.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          border: 1px solid var(--line);
          background: var(--bg);
        }
        .row {
          display: grid;
          grid-template-columns: 28px 1fr auto auto;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
        }
        .row-hit {
          display: flex;
          align-items: center;
          gap: 8px;
          grid-column: 1 / -1;
          cursor: pointer;
          width: 100%;
        }
        .row:last-child {
          border-bottom: none;
        }
        .row.off .label-input,
        .row.off .auto-label {
          color: var(--muted);
        }
        .tick {
          display: flex;
          justify-content: center;
          cursor: pointer;
        }
        .label-input {
          border: none;
          background: transparent;
          padding: 4px 0;
          width: 100%;
        }
        .auto-label em {
          margin-left: 8px;
          font-style: normal;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .req {
          display: flex;
          gap: 4px;
          align-items: center;
          font-size: 11px;
          color: var(--muted);
        }
        .remove {
          border: none;
          background: none;
          color: var(--muted);
          font-size: 12px;
          padding: 0 4px;
        }
        .remove:hover {
          color: var(--red);
        }
        .add {
          display: grid;
          grid-template-columns: 140px 1fr auto;
          gap: 8px;
        }
        .add input,
        .add select {
          border: 1px solid var(--line);
          background: var(--surface);
          padding: 8px 10px;
        }
        .foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
      `}</style>
    </form>
  );
}
