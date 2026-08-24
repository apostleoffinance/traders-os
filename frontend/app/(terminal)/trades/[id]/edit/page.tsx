"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Trade } from "@/lib/types";
import { TradeForm } from "@/components/TradeForm";

export default function EditTradePage() {
  const params = useParams<{ id: string }>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Trade>(`/api/trades/${params.id}`)
      .then(setTrade)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  if (error) return <p className="muted">{error}</p>;
  if (!trade) return <p className="muted">Loading…</p>;
  return <TradeForm mode="edit" trade={trade} />;
}
