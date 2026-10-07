"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import type { Account } from "@/lib/types";
import { RiskPolicyForm } from "@/components/accounts/RiskPolicyForm";

export default function RiskLimitsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = () => {
      const id = getActiveAccountId();
      if (!id) {
        setAccount(null);
        setMissing(true);
        return;
      }
      setMissing(false);
      void api<Account>(`/api/accounts/${id}`)
        .then(setAccount)
        .catch(() => setMissing(true));
    };
    load();
    window.addEventListener("traderos-account", load);
    return () => window.removeEventListener("traderos-account", load);
  }, []);

  if (missing) {
    return (
      <p className="muted">
        Choose an account before editing limits. <Link href="/accounts">Open accounts</Link>
      </p>
    );
  }
  if (!account) return <p className="muted">Loading risk limits…</p>;

  return (
    <div>
      <p className="ws-kicker">07 · Risk limits</p>
      <h1>{account.account_name}</h1>
      <p className="muted">
        {account.firm} · {account.program}. Saving updates this account only.
      </p>
      <RiskPolicyForm accountId={account.id} initial={account.risk_profile} />
    </div>
  );
}
