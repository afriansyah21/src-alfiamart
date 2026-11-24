"""GET /v1/summaries: kartu ringkasan di dasbor, muncul tanpa owner bertanya (sesi 3)."""
import logging
from typing import Literal

from fastapi import APIRouter, Header, Query

from ..config import settings
from ..periods import PeriodName, now_wib
from ..schemas import ERROR_RESPONSES, SummaryResponse
from ..stub import StubScenario, apply_failure_scenario, build_summary

logger = logging.getLogger("ai-service")
router = APIRouter(tags=["ringkasan"])


@router.get("/summaries", response_model=SummaryResponse, responses=ERROR_RESPONSES, summary="Ringkasan untuk dasbor")
async def summaries(
    # `type` adalah nama bawaan Python, jadi di kode dinamai `kind`; di URL tetap ?type=
    kind: Literal["sales", "price_changes"] = Query(alias="type", description="Jenis ringkasan"),
    period: PeriodName = Query(default="kemarin", description="Periode yang sudah lewat, dihitung dalam WIB"),
    x_stub_scenario: StubScenario | None = Header(
        default=None, description="Khusus pengujian: fallback, no_data, slow, unavailable, crash"
    ),
) -> SummaryResponse:
    scenario = x_stub_scenario if settings.stub_scenarios else None
    await apply_failure_scenario(scenario)
    data = build_summary(kind, period, now_wib(), scenario)
    logger.info("summary type=%s period=%s fallback=%s", kind, period, data.fallback)
    return SummaryResponse(data=data)
