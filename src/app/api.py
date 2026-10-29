from fastapi import FastAPI

from app.errors import register_error_handlers
from app.handlers import run


def create_app() -> FastAPI:
    app = FastAPI(title="streaming-entity-resolution", version="0.1.0")
    register_error_handlers(app)
    app.include_router(run.router)
    return app


app = create_app()
