from app.ai.response_evidence import build_response_evidence


def test_evidence_manifest_deduplicates_and_only_accepts_server_trade_refs() -> None:
    evidence = build_response_evidence({
        "evidence_refs": [
            {"trade_id": "t1", "role": "current_trade", "symbol": "EURUSD", "status": "closed"},
            {"trade_id": "t1", "role": "duplicate", "symbol": "EURUSD", "status": "closed"},
            {"trade_id": "", "symbol": "BTCUSDT"},
            "model-invented-trade",
        ],
        "research_context": {"filters": {"symbol": "EURUSD"}, "sample": {"n": 12}},
    })

    assert evidence["source"] == "server_validated_context"
    assert evidence["source_trade_count"] == 1
    assert evidence["supporting_trades"][0]["trade_id"] == "t1"
    assert evidence["filters"] == {"symbol": "EURUSD"}
    assert evidence["limitations"] == []


def test_evidence_manifest_discloses_aggregate_only_context() -> None:
    evidence = build_response_evidence({"finding": {"summary": "aggregate finding"}})
    assert evidence["supporting_trades"] == []
    assert evidence["source_trade_count"] == 0
    assert evidence["limitations"]
