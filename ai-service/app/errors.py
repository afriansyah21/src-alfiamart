"""Format error yang sama dengan Express (sesi 2c):

    { "success": false, "error": { "code": "...", "message": "...", "details": [...] } }

`message` ditujukan untuk developer (dibaca Ammar di log), bukan untuk owner.
Jangan pernah memasukkan potongan kode, API key, atau pesan error mentah Python ke sini.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("ai-service")


class ApiError(Exception):
    """Error yang memang direncanakan, misalnya kunci salah atau model belum siap."""

    def __init__(self, status: int, code: str, message: str, details: list | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def error_response(status: int, code: str, message: str, details: list | None = None) -> JSONResponse:
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status, content={"success": False, "error": error})


_HTTP_ERRORS = {
    404: ("NOT_FOUND", "Endpoint tidak ditemukan"),
    405: ("METHOD_NOT_ALLOWED", "Metode HTTP tidak diizinkan untuk endpoint ini"),
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def on_api_error(_request: Request, exc: ApiError):
        return error_response(exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_request: Request, exc: RequestValidationError):
        # Bawaan FastAPI: 422 + {"detail": [...]}. Kontrak kita: 400 + amplop, sama seperti Express.
        details = [
            {"field": ".".join(str(part) for part in err["loc"][1:]) or str(err["loc"][0]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return error_response(400, "VALIDATION_ERROR", "Request tidak sesuai kontrak", details)

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(_request: Request, exc: StarletteHTTPException):
        code, message = _HTTP_ERRORS.get(exc.status_code, ("HTTP_ERROR", str(exc.detail)))
        return error_response(exc.status_code, code, message)

    @app.exception_handler(Exception)
    async def on_unexpected_error(_request: Request, _exc: Exception):
        logger.exception("Error tak terduga")  # detail lengkap hanya masuk log
        return error_response(500, "INTERNAL_ERROR", "Terjadi kesalahan pada layanan AI")
