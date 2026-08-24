"use client";

import { TradeCalculator } from "@/components/TradeCalculator";
import { Button } from "@/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: {
    symbol?: string;
    direction?: string;
    entry?: string;
    stop_loss?: string;
    take_profit?: string;
    lot_size?: string;
    risk_amount?: string;
  };
  onApply: (values: {
    symbol: string;
    direction: string;
    entry: string;
    stop_loss: string;
    take_profit: string;
    lot_size: string;
  }) => void;
};

export function CalculatorDrawer({ open, onClose, initial, onApply }: Props) {
  if (!open) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Trade calculator">
      <div className="drawer">
        <header>
          <div>
            <p className="kicker">Calculate risk</p>
            <h2>Trade Calculator</h2>
          </div>
          <Button type="button" kind="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <TradeCalculator
          compact
          initial={initial}
          onApply={(v) => {
            onApply(v);
            onClose();
          }}
        />
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
          width: min(520px, 100%);
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
          color: var(--text-secondary);
        }
        h2 {
          margin: 4px 0 0;
          font-size: 20px;
        }
      `}</style>
    </div>
  );
}
