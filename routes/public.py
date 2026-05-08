"""
public.py — Public token-based routes for 2-phase HR interview workflow.

No authentication required. Candidates use access tokens to:
1. View available interview slots
2. Select a preferred slot for Round 1 AI interview
3. View Round 2 in-person interview details
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import get_db
from models import Result, AccessToken, InterviewSlot, Round2Interview, Candidate
from routes.common import serialize_result

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/slot-picker/{token}")
def get_slot_picker_data(token: str, db: Session = Depends(get_db)):
    """Retrieve candidate info and available slots for slot selection (public link)."""
    access_token = db.query(AccessToken).filter(
        and_(
            AccessToken.token == token,
            AccessToken.used_at.is_(None)
        )
    ).first()
    
    if not access_token:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    result = db.query(Result).filter(Result.id == access_token.result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    candidate = db.query(Candidate).filter(Candidate.id == result.candidate_id).first()
    slots = db.query(InterviewSlot).filter(InterviewSlot.result_id == result.id).all()
    
    return {
        "ok": True,
        "candidate_name": candidate.name if candidate else "Candidate",
        "candidate_email": candidate.email if candidate else "",
        "job_title": result.job.title if result.job else "Position",
        "slots": [
            {
                "id": slot.id,
                "datetime": slot.slot_datetime.isoformat(),
                "is_selected": slot.is_selected,
            }
            for slot in slots
        ],
    }


@router.post("/select-slot/{token}")
def select_interview_slot(token: str, payload: dict, db: Session = Depends(get_db)):
    """Candidate selects their preferred interview slot."""
    access_token = db.query(AccessToken).filter(
        and_(
            AccessToken.token == token,
            AccessToken.used_at.is_(None)
        )
    ).first()
    
    if not access_token:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    slot_id = payload.get("slot_id")
    if not slot_id:
        raise HTTPException(status_code=400, detail="Missing slot_id")
    
    result = db.query(Result).filter(Result.id == access_token.result_id).first()
    slot = db.query(InterviewSlot).filter(
        and_(
            InterviewSlot.id == slot_id,
            InterviewSlot.result_id == result.id
        )
    ).first()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    # Clear previous selection
    db.query(InterviewSlot).filter(InterviewSlot.result_id == result.id).update(
        {InterviewSlot.is_selected: False}
    )
    
    # Mark selected slot
    slot.is_selected = True
    
    # Mark token as used
    access_token.used_at = datetime.utcnow()
    
    # Update result with interview datetime
    result.interview_datetime = slot.slot_datetime
    
    db.commit()
    
    return {
        "ok": True,
        "message": "Slot selected successfully",
        "interview_datetime": slot.slot_datetime.isoformat(),
    }


@router.get("/interview-access/{token}")
def get_interview_access(token: str, db: Session = Depends(get_db)):
    """Get interview access link for Round 1 (post slot selection)."""
    access_token = db.query(AccessToken).filter(AccessToken.token == token).first()
    
    if not access_token:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    result = db.query(Result).filter(Result.id == access_token.result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    return {
        "ok": True,
        "result_id": result.id,
        "interview_datetime": result.interview_datetime.isoformat() if result.interview_datetime else None,
        "interview_link": f"/interview/{result.id}",
    }


@router.get("/round2-details/{token}")
def get_round2_interview_details(token: str, db: Session = Depends(get_db)):
    """Get Round 2 in-person interview details (after selection)."""
    access_token = db.query(AccessToken).filter(AccessToken.token == token).first()
    
    if not access_token:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    result = db.query(Result).filter(Result.id == access_token.result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    round2 = db.query(Round2Interview).filter(Round2Interview.result_id == result.id).first()
    if not round2:
        raise HTTPException(status_code=404, detail="Round 2 not scheduled yet")
    
    candidate = db.query(Candidate).filter(Candidate.id == result.candidate_id).first()
    
    return {
        "ok": True,
        "candidate_name": candidate.name if candidate else "Candidate",
        "job_title": result.job.title if result.job else "Position",
        "round2_datetime": round2.interview_datetime.isoformat(),
        "location": round2.location,
        "notes": round2.interviewer_notes,
    }
