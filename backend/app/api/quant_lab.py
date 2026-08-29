from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.services import auth_service, quant_lab_service

quant_lab_router = APIRouter(prefix="/quant-lab", tags=["quant-lab"])


def _user(db, user_id):
    return auth_service.get_user(db, user_id)


def _call(service_fn, db, user_id, account_id, **kwargs):
    try:
        return service_fn(db, _user(db, user_id), account_id, **kwargs)
    except DomainError as exc:
        raise http_error(exc) from exc
    except ValueError as exc:
        raise http_error(DomainError(str(exc), "invalid_period")) from exc


@quant_lab_router.get("/overview")
def quant_overview(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.overview,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/edge")
def quant_edge(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.edge,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/drawdown")
def quant_drawdown(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.drawdown,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/rolling")
def quant_rolling(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.rolling,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("")
def quant_full(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.full,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


class BootstrapParams(BaseModel):
    iterations: int = Field(default=5000, ge=100, le=25000)
    seed: int = Field(default=42, ge=0)


@quant_lab_router.get("/distribution")
def quant_distribution(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.distribution,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/outliers")
def quant_outliers(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.outliers,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/robustness")
def quant_robustness(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.robustness,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.post("/bootstrap")
def quant_bootstrap(
    account_id: UUID,
    body: BootstrapParams,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.bootstrap_analysis,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
        iterations=body.iterations,
        seed=body.seed,
    )


class MonteCarloParams(BaseModel):
    simulations: int = Field(default=10_000, ge=100, le=25_000)
    future_trades: int = Field(default=100, ge=1, le=500)
    seed: int = Field(default=42, ge=0)
    unit: str = Field(default="R", pattern="^(R|currency)$")
    drawdown_threshold: float | None = Field(default=10.0, ge=0)


class RiskOfRuinParams(BaseModel):
    account_equity: float | None = Field(default=None, gt=0)
    risk_per_trade_pct: float | None = Field(default=None, gt=0)
    ruin_drawdown_pct: float = Field(default=20.0, gt=0, le=100)
    simulations: int = Field(default=10_000, ge=100, le=25_000)
    future_trades: int = Field(default=200, ge=1, le=500)
    seed: int = Field(default=42, ge=0)


@quant_lab_router.get("/simulation")
def quant_simulation_preview(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.simulation_preview_endpoint,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.post("/monte-carlo")
def quant_monte_carlo(
    account_id: UUID,
    body: MonteCarloParams,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    from decimal import Decimal

    threshold = Decimal(str(body.drawdown_threshold)) if body.drawdown_threshold is not None else None
    return _call(
        quant_lab_service.monte_carlo,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
        simulations=body.simulations,
        future_trades=body.future_trades,
        seed=body.seed,
        unit=body.unit,
        drawdown_threshold=threshold,
    )


@quant_lab_router.post("/risk-of-ruin")
def quant_risk_of_ruin(
    account_id: UUID,
    body: RiskOfRuinParams,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    from decimal import Decimal

    equity = Decimal(str(body.account_equity)) if body.account_equity is not None else None
    risk_pct = Decimal(str(body.risk_per_trade_pct)) if body.risk_per_trade_pct is not None else None
    return _call(
        quant_lab_service.risk_of_ruin,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
        account_equity=equity,
        risk_per_trade_pct=risk_pct,
        ruin_drawdown_pct=Decimal(str(body.ruin_drawdown_pct)),
        simulations=body.simulations,
        future_trades=body.future_trades,
        seed=body.seed,
    )


@quant_lab_router.get("/behavior")
def quant_behavior(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.behavior,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/compare")
def quant_compare(
    account_id: UUID,
    setup: str | None = None,
    session: str | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    emotion: str | None = None,
    confirmation: bool | None = None,
    rules_followed: bool | None = None,
    emotional: bool | None = None,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    setup_id: UUID | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.compare_combination,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
        setup=setup,
        emotion=emotion,
        confirmation=confirmation,
        rules_followed=rules_followed,
        emotional=emotional,
    )


@quant_lab_router.get("/research-opportunities")
def quant_research_opportunities(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.research_opportunities,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )


@quant_lab_router.get("/walk-forward")
def quant_walk_forward(
    account_id: UUID,
    split_ratio: float = Query(0.7, ge=0.1, le=0.9),
    training_from: str | None = None,
    training_to: str | None = None,
    validation_from: str | None = None,
    validation_to: str | None = None,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(
        quant_lab_service.walk_forward,
        db,
        user_id,
        account_id,
        preset=preset,
        date_from=date_from,
        date_to=date_to,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
        split_ratio=split_ratio,
        training_from=training_from,
        training_to=training_to,
        validation_from=validation_from,
        validation_to=validation_to,
    )
