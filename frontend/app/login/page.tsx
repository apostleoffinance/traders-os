"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, api, setSession } from "@/lib/api";
import type { TokenPair } from "@/lib/types";
import { Alert, Button, Field } from "@/components/ui";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<TokenPair>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data.access_token, data.refresh_token, JSON.stringify(data.user));
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password."
          : err instanceof Error
            ? err.message
            : "Unable to sign in.",
      );
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
        <h1>Sign in</h1>
        <p className="muted">Journal. Risk. Discipline. Not a signal engine.</p>
        {error && <Alert kind="danger">{error}</Alert>}
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <span className="password-row">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p>
          No account? <Link href="/register">Create one</Link>
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
        .password-row {
          position: relative;
          display: block;
        }
        .password-row input {
          width: 100%;
          padding-right: 64px;
        }
        .password-toggle {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px;
        }
        .password-toggle:hover {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
