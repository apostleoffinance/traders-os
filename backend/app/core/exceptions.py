from __future__ import annotations

from fastapi import HTTPException, status


class DomainError(Exception):
    def __init__(self, message: str, code: str = "domain_error") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class NotFoundError(DomainError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, "not_found")


class ConflictError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "conflict")


class PolicyViolation(DomainError):
    def __init__(self, message: str, code: str = "policy_violation") -> None:
        super().__init__(message, code)


class AIUnavailable(DomainError):
    def __init__(self, message: str = "AI analysis temporarily unavailable.") -> None:
        super().__init__(message, "ai_unavailable")


class ProviderUnavailable(DomainError):
    def __init__(self, message: str = "Market data temporarily unavailable.") -> None:
        super().__init__(message, "provider_unavailable")


class UnsupportedTimeframe(DomainError):
    def __init__(self, message: str = "Timeframe is not supported for this instrument.") -> None:
        super().__init__(message, "unsupported_timeframe")


class ConversionUnavailable(DomainError):
    def __init__(
        self,
        message: str = "Conversion rate unavailable. Position-size calculation cannot be verified.",
    ) -> None:
        super().__init__(message, "conversion_unavailable")


class AIGuardrailRejected(DomainError):
    def __init__(
        self,
        message: str = "Model output contained prohibited trading advice and was discarded.",
    ) -> None:
        super().__init__(message, "ai_guardrail")


def http_error(exc: DomainError) -> HTTPException:
    status_map = {
        "not_found": status.HTTP_404_NOT_FOUND,
        "conflict": status.HTTP_409_CONFLICT,
        "policy_violation": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "policy_blocked": status.HTTP_409_CONFLICT,
        "ai_unavailable": status.HTTP_503_SERVICE_UNAVAILABLE,
        "ai_guardrail": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "invalid_period": status.HTTP_400_BAD_REQUEST,
        "provider_unavailable": status.HTTP_503_SERVICE_UNAVAILABLE,
        "unsupported_timeframe": status.HTTP_400_BAD_REQUEST,
        "conversion_unavailable": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "push_unavailable": status.HTTP_503_SERVICE_UNAVAILABLE,
    }
    return HTTPException(
        status_code=status_map.get(exc.code, status.HTTP_400_BAD_REQUEST),
        detail={"code": exc.code, "message": exc.message},
    )
