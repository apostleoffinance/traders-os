from fastapi import APIRouter

from app.api.ai import router as ai_router
from app.api.accounts import router as accounts_router
from app.api.analytics import analytics_router, dashboard_router, risk_router
from app.api.auth import router as auth_router
from app.api.catalog import (
    checklists_router,
    events_router,
    instruments_router,
    media_router,
    setups_router,
)
from app.api.calculator import router as calculator_router
from app.api.intelligence import router as intelligence_router
from app.api.quant_lab import quant_lab_router
from app.api.push import router as push_router
from app.api.trades import router as trades_router
from app.integrations.mt5.router import router as mt5_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(accounts_router)
api_router.include_router(trades_router)
api_router.include_router(dashboard_router)
api_router.include_router(analytics_router)
api_router.include_router(risk_router)
api_router.include_router(setups_router)
api_router.include_router(checklists_router)
api_router.include_router(instruments_router)
api_router.include_router(events_router)
api_router.include_router(media_router)
api_router.include_router(push_router)
api_router.include_router(ai_router)
api_router.include_router(intelligence_router)
api_router.include_router(calculator_router)
api_router.include_router(mt5_router)
api_router.include_router(quant_lab_router)
