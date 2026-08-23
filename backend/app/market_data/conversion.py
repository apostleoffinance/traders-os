"""Quote → account currency conversion. Never fabricates a missing rate."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.engines.fx_math import ONE, ZERO, InstrumentSpec, get_instrument

USDT_USD_PARITY = Decimal("1")


@dataclass(frozen=True)
class ConversionResult:
    rate: Decimal | None
    assumed: bool
    reason: str | None
    pair: str | None = None


def conversion_for_account(
    spec: InstrumentSpec,
    account_currency: str,
    *,
    quote_price: Decimal | None = None,
    usd_cross: Decimal | None = None,
) -> ConversionResult:
    """Return the multiplier applied to quote-currency P/L to get account currency.

    EURUSD + USD account → 1.
    USDJPY + USD account → 1 / USDJPY (P/L is in JPY).
    BTCUSDT + USD account → 1 if USDT is treated as USD-pegged (flagged assumed).
    """
    account = account_currency.upper()
    quote = spec.quote_currency.upper()
    if quote == account:
        return ConversionResult(ONE, False, None)
    if quote == "USDT" and account == "USD":
        return ConversionResult(
            USDT_USD_PARITY,
            True,
            "USDT treated as USD-pegged. Conversion is assumed, not a verified FX rate.",
            "USDTUSD",
        )
    if quote == "USD" and account != "USD":
        if usd_cross is None or usd_cross <= ZERO:
            return ConversionResult(
                None,
                False,
                f"{quote}→{account} conversion rate unavailable. Position-size calculation cannot be verified.",
                f"USD{account}",
            )
        return ConversionResult(usd_cross, False, None, f"USD{account}")
    # P/L in quote. Convert quote → account via 1/price of ACCOUNTQUOTE or QUOTEACCOUNT.
    if account == "USD" and quote_price is not None and quote_price > ZERO:
        # USDJPY last is JPY per USD, so 1 JPY = 1/last USD.
        return ConversionResult(ONE / quote_price, False, None, spec.symbol)
    return ConversionResult(
        None,
        False,
        f"{quote}→{account} conversion rate unavailable. Position-size calculation cannot be verified.",
        f"{quote}{account}",
    )


def conversion_for_symbol(
    symbol: str,
    account_currency: str,
    *,
    quote_price: Decimal | None = None,
) -> ConversionResult:
    spec = get_instrument(symbol)
    return conversion_for_account(spec, account_currency, quote_price=quote_price)


def needs_quote_price(spec: InstrumentSpec, account_currency: str) -> bool:
    quote = spec.quote_currency.upper()
    account = account_currency.upper()
    if quote == account:
        return False
    if quote == "USDT" and account == "USD":
        return False
    return True
