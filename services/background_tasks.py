from fastapi import BackgroundTasks
from typing import Callable, Awaitable, Any
import traceback
from .logging import logger
from utils.s3_utils import async_upload_proctor_image


def schedule_proctor_image_upload(
    background: BackgroundTasks,
    session_id: int,
    image_bytes: bytes,
    timestamp: str,
    request_id: str = ""
) -> None:
    """Schedule the async S3 upload, propagating the request-ID for correlated logs."""
    async def _run():
        try:
            await async_upload_proctor_image(session_id, image_bytes, timestamp)
            logger.info(
                "proctor_image_uploaded",
                extra={"session_id": session_id, "request_id": request_id},
            )
        except Exception:
            logger.exception(
                "proctor_image_upload_failed",
                extra={"session_id": session_id, "request_id": request_id, "trace": traceback.format_exc()},
            )
    background.add_task(_run)


def schedule_generic_task(
    background: BackgroundTasks,
    func: Callable[..., Awaitable[Any]],
    *args,
    request_id: str = "",
    **kwargs,
) -> None:
    """Run *func* in the background while preserving *request_id* for logging."""
    async def _run():
        try:
            await func(*args, **kwargs)
            logger.info(
                "background_task_completed",
                extra={"func": func.__name__, "request_id": request_id},
            )
        except Exception:
            logger.exception(
                "background_task_failed",
                extra={"func": func.__name__, "request_id": request_id, "trace": traceback.format_exc()},
            )
    background.add_task(_run)