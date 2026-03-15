"""
routes/interview/evaluation.py

Single endpoint: POST /api/interview/{session_id}/evaluate
Called once by the frontend when interview status becomes completed.
Loops through all answered questions, scores each with Groq LLM,
saves llm_score + llm_feedback back to interview_answers rows.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import InterviewAnswer, InterviewQuestion, InterviewSession, JobDescription, Result
from routes.dependencies import SessionUser, require_role
from services.llm.client import score_answer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["interview-evaluation"])


@router.post("/interview/{session_id}/evaluate")
def evaluate_interview(
    session_id: int,
    current_user: SessionUser = Depends(require_role("candidate")),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """
    Score all answers for a completed interview session using Groq LLM.
    Idempotent — safe to call multiple times.
    """
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.candidate_id == current_user.user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    questions = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.id.asc())
        .all()
    )

    scored = 0
    total_score = 0.0

    for question in questions:
        answer_text = (question.answer_text or "").strip()
        if not answer_text or question.skipped:
            # Persist zero score for skipped / empty answers
            _upsert_llm_fields(db, session_id, question.id, 0, "Answer was skipped or empty.")
            continue

        result = score_answer(question.text, answer_text)
        llm_score = int(result["score"])
        llm_feedback = str(result["feedback"])

        _upsert_llm_fields(db, session_id, question.id, llm_score, llm_feedback)
        total_score += llm_score
        scored += 1

    db.commit()

    avg_score = round(total_score / scored, 1) if scored else 0.0
    return {
        "ok": True,
        "session_id": session_id,
        "questions_evaluated": scored,
        "average_llm_score": avg_score,
    }


def _upsert_llm_fields(
    db: Session,
    session_id: int,
    question_id: int,
    llm_score: int,
    llm_feedback: str,
) -> None:
    """Save or update llm_score + llm_feedback on the answer row."""
    answer = (
        db.query(InterviewAnswer)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.question_id == question_id,
        )
        .order_by(InterviewAnswer.id.desc())
        .first()
    )
    if answer:
        answer.llm_score = llm_score
        answer.llm_feedback = llm_feedback
    # If no InterviewAnswer row, write to the question directly as fallback
    question = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()
    if question:
        question.llm_score = llm_score
        question.llm_feedback = llm_feedback
