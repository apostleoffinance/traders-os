"use client";

import { useEffect, useState } from "react";
import type { Mt5ConnectionCreated } from "@/lib/mt5";
import { mt5ApiBaseUrl, mt5EaDownloadUrl } from "@/lib/mt5";
import type { Mt5Connection } from "@/lib/types";
import { Alert, Button } from "@/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  existingConnection: Mt5Connection | null;
  initialToken: string | null;
  onCreated: (conn: Mt5ConnectionCreated) => void;
  createConnection: (accountId: string) => Promise<Mt5ConnectionCreated>;
};

const STEPS = ["intro", "token", "install"] as const;
type Step = (typeof STEPS)[number];

type CopyField = "token" | "api" | null;

export function Mt5ConnectDrawer({
  open,
  onClose,
  accountId,
  existingConnection,
  initialToken,
  onCreated,
  createConnection,
}: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyField>(null);

  const apiUrl = mt5ApiBaseUrl();
  const downloadUrl = mt5EaDownloadUrl();

  useEffect(() => {
    if (!open) return;
    if (initialToken) {
      setStep("install");
    } else if (existingConnection && existingConnection.status !== "revoked") {
      setStep("install");
    } else {
      setStep("intro");
    }
    setToken(initialToken);
    setError(null);
    setCopied(null);
  }, [open, initialToken, existingConnection]);

  if (!open) return null;

  async function generateToken() {
    setBusy(true);
    setError(null);
    try {
      const created = await createConnection(accountId);
      setToken(created.connection_token);
      onCreated(created);
      setStep("install");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create connection");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value: string, field: CopyField) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  function stepperDone(s: Step): boolean {
    return STEPS.indexOf(step) > STEPS.indexOf(s);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Connect MetaTrader 5">
      <div className="drawer">
        <header>
          <div>
            <p className="kicker">Integration</p>
            <h2>Connect MetaTrader 5</h2>
          </div>
          <Button type="button" kind="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <nav className="stepper" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <span key={s} className={step === s ? "active" : stepperDone(s) ? "done" : ""}>
              {i + 1}. {s === "intro" ? "Overview" : s === "token" ? "Code" : "Install"}
            </span>
          ))}
        </nav>

        {error && <Alert kind="danger">{error}</Alert>}

        {step === "intro" && (
          <section>
            <p>
              Sync trades from your MT5 terminal into this journal automatically. Setup takes about 5
              minutes and only needs to be done once per computer.
            </p>
            <ul className="checks">
              <li>Reads open and closed trades</li>
              <li>Updates every ~10 seconds while MT5 is running</li>
            </ul>
            <ul className="blocks">
              <li>Cannot place, modify, or close trades</li>
              <li>Cannot access your MT5 password</li>
            </ul>
            <div className="row">
              <Button
                type="button"
                onClick={() => {
                  if (existingConnection && existingConnection.status !== "revoked") {
                    setStep("install");
                  } else {
                    void generateToken();
                  }
                }}
                disabled={busy}
              >
                {busy ? "Starting…" : existingConnection ? "View setup steps" : "Get started"}
              </Button>
            </div>
          </section>
        )}

        {step === "token" && (
          <section>
            <p className="muted">Your connection code is shown once. Copy it before continuing.</p>
            {!token ? (
              <Button type="button" onClick={() => void generateToken()} disabled={busy}>
                {busy ? "Generating…" : "Generate connection code"}
              </Button>
            ) : (
              <>
                <div className="token-box">
                  <code>{token}</code>
                </div>
                <div className="row">
                  <Button type="button" onClick={() => void copyText(token, "token")}>
                    {copied === "token" ? "Copied" : "Copy code"}
                  </Button>
                  <Button type="button" kind="ghost" onClick={() => void generateToken()} disabled={busy}>
                    Regenerate
                  </Button>
                </div>
                <p className="warn">Regenerating invalidates any EA using the previous code.</p>
                <Button type="button" onClick={() => setStep("install")}>
                  Continue to installation
                </Button>
              </>
            )}
          </section>
        )}

        {step === "install" && (
          <section>
            <div className="download-card">
              <div>
                <p className="label">Step 1 — Download</p>
                <p className="muted">Pre-built Expert Advisor. No MetaEditor or compiling required.</p>
              </div>
              <a className="download-btn" href={downloadUrl} download="TraderOSSync.zip">
                Download TraderOSSync.zip
              </a>
            </div>

            <ol className="steps">
              <li>
                Unzip and copy the <code>TraderOSSync</code> folder into MT5:{" "}
                <strong>File → Open Data Folder → MQL5 → Experts</strong>
              </li>
              <li>
                In MT5 <strong>Navigator → Expert Advisors</strong>, refresh, then drag{" "}
                <strong>TraderOSSync</strong> onto any chart
              </li>
              <li>
                Set <strong>ApiBaseUrl</strong> to:
                <div className="copy-row">
                  <code className="copy-value">{apiUrl}</code>
                  <Button type="button" kind="ghost" onClick={() => void copyText(apiUrl, "api")}>
                    {copied === "api" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </li>
              <li>
                Set <strong>ConnectionToken</strong> to your code:
                {token ? (
                  <div className="copy-row">
                    <code className="copy-value">{token}</code>
                    <Button type="button" kind="ghost" onClick={() => void copyText(token, "token")}>
                      {copied === "token" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ) : (
                  <div className="row">
                    <Button type="button" onClick={() => setStep("token")}>
                      Show connection code
                    </Button>
                    {!existingConnection && (
                      <Button type="button" kind="ghost" onClick={() => void generateToken()} disabled={busy}>
                        Generate code
                      </Button>
                    )}
                  </div>
                )}
              </li>
              <li>
                <strong>Tools → Options → Expert Advisors</strong> → enable{" "}
                <em>Allow WebRequest for listed URL</em> and add:
                <div className="copy-row">
                  <code className="copy-value">{apiUrl}</code>
                  <Button type="button" kind="ghost" onClick={() => void copyText(apiUrl, "api")}>
                    {copied === "api" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <span className="hint">Use the URL only — no <code>/api/...</code> path.</span>
              </li>
              <li>Enable <strong>Algo Trading</strong> on the chart</li>
              <li>
                Check the chart <strong>Experts</strong> tab for <code>TraderOSSync OK</code>. This page
                will show <strong>LIVE SYNC</strong> within a few seconds.
              </li>
            </ol>

            <Alert kind="info">
              Keep MT5 open while you trade. If sync stops, confirm Algo Trading is on and your computer
              did not sleep.
            </Alert>
          </section>
        )}
      </div>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: color-mix(in srgb, var(--bg) 35%, transparent);
          backdrop-filter: blur(2px);
          display: flex;
          justify-content: flex-end;
        }
        .drawer {
          width: min(560px, 100%);
          height: 100%;
          overflow: auto;
          background: var(--bg);
          border-left: 1px solid var(--line-strong);
          padding: 16px 18px 32px;
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 12px;
        }
        .kicker {
          margin: 0;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        h2 {
          margin: 4px 0 0;
          font-size: 1.25rem;
        }
        .stepper {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .stepper span.active {
          color: var(--accent);
          font-weight: 600;
        }
        .stepper span.done {
          color: var(--text);
        }
        section p {
          line-height: 1.5;
        }
        .checks,
        .blocks {
          padding-left: 1.2rem;
          line-height: 1.6;
        }
        .blocks {
          color: var(--muted);
        }
        .token-box {
          margin: 12px 0;
          padding: 14px;
          border: 1px dashed var(--line-strong);
          border-radius: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 1.1rem;
          letter-spacing: 0.06em;
          word-break: break-all;
        }
        .row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .copy-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0;
          flex-wrap: wrap;
        }
        .copy-value {
          flex: 1;
          min-width: 0;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 6px;
          font-family: var(--font-mono), monospace;
          font-size: 0.85rem;
          word-break: break-all;
        }
        .warn {
          font-size: 0.9rem;
          color: var(--warn);
        }
        .hint {
          display: block;
          font-size: 0.85rem;
          color: var(--muted);
          margin-top: 4px;
        }
        .steps {
          line-height: 1.65;
          padding-left: 1.2rem;
          margin: 16px 0;
        }
        .steps code {
          font-family: var(--font-mono), monospace;
          font-size: 0.9em;
        }
        .steps li {
          margin-bottom: 12px;
        }
        .label {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .download-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px;
          border: 1px solid var(--line-strong);
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .download-btn {
          display: inline-block;
          padding: 8px 14px;
          border: 1px solid var(--accent);
          border-radius: var(--radius-sm);
          color: var(--accent);
          font-weight: 600;
          font-size: 0.9rem;
          text-decoration: none;
          white-space: nowrap;
        }
        .download-btn:hover {
          background: color-mix(in srgb, var(--accent) 12%, transparent);
        }
      `}</style>
    </div>
  );
}
