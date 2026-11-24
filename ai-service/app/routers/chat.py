"""POST /v1/chat: satu pintu untuk semua pesan owner (sesi 1 dan 2)."""
import logging

from fastapi import APIRouter, Header

from ..config import settings
from ..schemas import ERROR_RESPONSES, ChatRequest, ChatResponse
from ..stub import StubScenario, apply_failure_scenario, build_chat_data

logger = logging.getLogger("ai-service")
router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse, responses=ERROR_RESPONSES, summary="Jawab pesan owner")
async def chat(
    req: ChatRequest,
    x_stub_scenario: StubScenario | None = Header(
        default=None, description="Khusus pengujian: fallback, no_data, slow, unavailable, crash"
    ),
) -> ChatResponse:
    scenario = x_stub_scenario if settings.stub_scenarios else None
    await apply_failure_scenario(scenario)
    data = build_chat_data(req.message, req.channel, scenario)
    # Jejak di log memakai session_id. Isi pesan dan kunci tidak dicatat.
    logger.info("chat session=%s channel=%s intent=%s fallback=%s", req.session_id, req.channel, data.intent, data.fallback)
    return ChatResponse(data=data)
