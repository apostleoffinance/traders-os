from __future__ import annotations

from app.core.enums import AssetClass
from app.engines.fx_math import get_instrument, normalize_symbol
from app.market_data.providers.ccxt import crypto_providers
from app.market_data.providers.dukascopy import DukascopyProvider
from app.market_data.providers.oanda import OandaProvider
from app.market_data.schemas import MarketDataProvider


def fx_chain() -> list[MarketDataProvider]:
    providers: list[MarketDataProvider] = [DukascopyProvider()]
    oanda = OandaProvider()
    if oanda.enabled():
        providers.append(oanda)
    return providers


def providers_for_symbol(symbol: str) -> list[MarketDataProvider]:
    key = normalize_symbol(symbol)
    try:
        spec = get_instrument(key)
        asset = spec.asset_class
    except Exception:
        if key.endswith("USDT") or "/" in symbol:
            asset = AssetClass.CRYPTO.value
        else:
            asset = AssetClass.FX.value
    if asset == AssetClass.CRYPTO.value:
        return [p for p in crypto_providers() if p.enabled()]
    return [p for p in fx_chain() if p.enabled()]


def all_providers() -> list[MarketDataProvider]:
    return [*fx_chain(), *crypto_providers()]
