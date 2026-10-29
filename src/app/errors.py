from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

PROBLEM_MEDIA_TYPE = "application/problem+json"


class AppError(Exception):
    def __init__(self, *, code: str, status: int, title: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.status = status
        self.title = title
        self.detail = detail


async def handle_app_error(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, AppError):
        raise error
    return JSONResponse(
        status_code=error.status,
        content={
            "type": "about:blank",
            "title": error.title,
            "status": error.status,
            "detail": error.detail,
            "code": error.code,
            "instance": request.url.path,
        },
        media_type=PROBLEM_MEDIA_TYPE,
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
