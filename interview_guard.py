"""
interview_guard.py
------------------
Enforces: one interview attempt per (candidate, JD) pair.

A candidate may interview for as many JDs as they like, but cannot
repeat an interview for a JD where a completed session already exists.

Usage in routes/interview/runtime.py
--------------------------------------
    from interview_guard import assert_candidate_can_interview

    # Inside your POST /api/interview/start handler, after loading the result:
    assert_candidate_can_interview(db, candidate_id=candidate.id, job_id=result.job_id)
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import InterviewSession, Result

# Statuses that count as "interview used up" for this JD
TERMINAL_STATUSES = {"completed", "terminated", "submitted"}


def get_completed_session(db: Session, result_id: int) -> InterviewSession | None:
    """Return a terminal-status session for this result, or None."""
    return (
        db.query(InterviewSession)
        .filter(
            InterviewSession.result_id == result_id,
            InterviewSession.status.in_(TERMINAL_STATUSES),
        )
        .first()
    )


def assert_candidate_can_interview(
    db: Session,
    candidate_id: int,
    job_id: int,
) -> Result:
    """
    Check whether this candidate is allowed to start an interview for this JD.

    Logic
    -----
    1. No Result row for (candidate, job)    -> never applied, raise 404.
    2. Result exists, no terminal session    -> first attempt, allow. Return Result.
    3. Result exists, terminal session found -> already interviewed, raise 409.

    Raises
    ------
    HTTP 404  Result not found for this candidate + JD combination.
    HTTP 409  Candidate has already completed an interview for this JD.

    Returns
    -------
    Result  The Result ORM row, ready for the caller to use.
    """
    result = (
        db.query(Result)
        .filter(
            Result.candidate_id == candidate_id,
            Result.job_id == job_id,
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No application found for this candidate and JD.",
        )

    completed = get_completed_session(db, result_id=result.id)
    if completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "You have already completed an interview for this position. "
                "You may apply and interview for other open positions."
            ),
        )

    return result
