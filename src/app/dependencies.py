from typing import Annotated

from fastapi import Depends

from app.config import get_settings
from app.repositories.run_files import RunFiles


def get_run_files() -> RunFiles:
    settings = get_settings()
    return RunFiles(out_dir=settings.out_dir, signals_path=settings.signals_path)


RunFilesDep = Annotated[RunFiles, Depends(get_run_files)]
