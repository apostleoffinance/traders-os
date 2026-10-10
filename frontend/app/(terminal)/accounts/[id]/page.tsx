"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Account } from "@/lib/types";
import { Mt5ConnectionPanel } from "@/components/Mt5ConnectionPanel";
import { RiskPolicyForm } from "@/components/accounts/RiskPolicyForm";
import { money } from "@/lib/format";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const connectMt5 = searchParams.get("connect") === "mt5";
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    void api<Account>(`/api/accounts/${params.id}`).then(setAccount);
  }, [params.id]);

  if (!account) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>{account.account_name}</h1>
      <p className="muted">
        {account.firm} · {account.program} · starting {money(account.starting_balance)} · equity{" "}
        {money(account.current_equity)}
      </p>
      <Mt5ConnectionPanel accountId={params.id} autoOpen={connectMt5} />
      <RiskPolicyForm accountId={params.id} currency={account.currency} initial={account.risk_profile} />
    </div>
  );
}
