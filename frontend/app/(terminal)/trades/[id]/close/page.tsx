"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Trade } from "@/lib/types";
import { Alert } from "@/components/ui";
import { TradeForm } from "@/components/TradeForm";

export default function CloseTradePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Trade>(`/api/trades/${params.id}`)
      .then((t) => {
        if (t.status === "closed") {
          router.replace(`/trades/${t.id}`);
          return;
        }
        setTrade(t);
      })
      .catch((err: Error) => setError(err.message));
  }, [params.id, router]);

  if (error) {
    return (
      <Alert kind="danger">
        {error} <Link href={`/trades/${params.id}`}>Back</Link>
      </Alert>
    );
  }
  if (!trade) return <p className="muted">Loading…</p>;
  return <TradeForm mode="close" trade={trade} />;
}
