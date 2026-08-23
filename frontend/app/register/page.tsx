"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, setSession } from "@/lib/api";
import type { TokenPair } from "@/lib/types";
import { Alert, Button, Field } from "@/components/ui";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { guessTimezone } from "@/lib/timezones";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<TokenPair>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          timezone: guessTimezone(),
        }),
      });
      setSession(data.access_token, data.refresh_token, JSON.stringify(data.user));
      router.replace("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="theme">
        <ThemeToggle compact />
      </div>
      <form onSubmit={onSubmit}>
        <Link href="/" className="auth-brand">
          <BrandMark size={40} />
          <div className="kicker">Trader OS</div>
        </Link>
        <h1>Create account</h1>
        <p className="muted">Your data is isolated to this login. No setup = no trade.</p>
        {error && <Alert kind="danger">{error}</Alert>}
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
        <p>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
      <style jsx>{`
        .auth {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          position: relative;
        }
        form {
          width: 100%;
          max-width: 380px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        h1 {
          margin: 0;
          font-size: 22px;
        }
        .auth-brand {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        .kicker {
          font-family: "IBM Plex Mono", monospace;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 11px;
          color: var(--accent);
        }
        p :global(a) {
          text-decoration: underline;
        }
        .theme {
          position: absolute;
          top: 16px;
          right: 16px;
        }
      `}</style>
    </div>
  );
}
