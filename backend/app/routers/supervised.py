"""Supervised clip stats workflow: video analysis detects events, user reviews/confirms them."""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clip, ClipAnalysis, ClipStatSheet, DetectedEvent
from ..analyzer import analyze_basketball_clip

router = APIRouter(prefix="/api/supervised", tags=["supervised"])

UPLOADS_DIR = Path("uploads")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class EventReviewBody(BaseModel):
    confirmed: Optional[bool] = None
    user_label: Optional[str] = None
    notes: Optional[str] = None


class ManualEventBody(BaseModel):
    timestamp_seconds: float
    user_label: str
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sheet_to_dict(sheet: ClipStatSheet) -> dict:
    return {
        "id": sheet.id,
        "clip_id": sheet.clip_id,
        "sport": sheet.sport,
        "status": sheet.status,
        "points": sheet.points,
        "fg_made": sheet.fg_made,
        "fg_attempted": sheet.fg_attempted,
        "three_made": sheet.three_made,
        "three_attempted": sheet.three_attempted,
        "ft_made": sheet.ft_made,
        "ft_attempted": sheet.ft_attempted,
        "rebounds": sheet.rebounds,
        "assists": sheet.assists,
        "steals": sheet.steals,
        "blocks": sheet.blocks,
        "turnovers": sheet.turnovers,
        "created_at": sheet.created_at.isoformat() if sheet.created_at else None,
        "updated_at": sheet.updated_at.isoformat() if sheet.updated_at else None,
    }


def _event_to_dict(event: DetectedEvent) -> dict:
    return {
        "id": event.id,
        "clip_id": event.clip_id,
        "stat_sheet_id": event.stat_sheet_id,
        "timestamp_seconds": event.timestamp_seconds,
        "event_type": event.event_type,
        "auto_detected": event.auto_detected,
        "reviewed": event.reviewed,
        "confirmed": event.confirmed,
        "user_label": event.user_label,
        "notes": event.notes,
        "frame_number": event.frame_number,
        "confidence": event.confidence,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/start/{clip_id}")
def start_supervised_review(clip_id: int, db: Session = Depends(get_db)):
    """Start supervised review: run analysis if needed, create stat sheet + events."""
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    # Run basketball analysis if none exists yet
    existing_analysis = (
        db.query(ClipAnalysis)
        .filter(ClipAnalysis.clip_id == clip_id, ClipAnalysis.analysis_type == "basketball_pose")
        .order_by(ClipAnalysis.created_at.desc())
        .first()
    )

    if existing_analysis:
        analysis_results = json.loads(existing_analysis.results)
    else:
        video_path = UPLOADS_DIR / clip.filename
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video file not found on disk")

        analysis_results = analyze_basketball_clip(str(video_path))

        # Persist analysis
        new_analysis = ClipAnalysis(
            clip_id=clip_id,
            analysis_type="basketball_pose",
            results=json.dumps(analysis_results),
        )
        db.add(new_analysis)
        db.flush()

    # Create stat sheet
    sport = clip.sport or "basketball"
    sheet = ClipStatSheet(clip_id=clip_id, sport=sport, status="in_review")
    db.add(sheet)
    db.flush()

    # Convert detected shots into DetectedEvent rows
    events = []
    for shot in analysis_results.get("detected_shots", []):
        event = DetectedEvent(
            clip_id=clip_id,
            stat_sheet_id=sheet.id,
            timestamp_seconds=shot["timestamp"],
            event_type="shot_attempt",
            auto_detected=True,
            reviewed=False,
            confirmed=False,
            frame_number=shot.get("frame"),
            confidence=shot.get("confidence"),
        )
        db.add(event)
        events.append(event)

    db.commit()
    db.refresh(sheet)
    for e in events:
        db.refresh(e)

    return {
        "stat_sheet": _sheet_to_dict(sheet),
        "events": [_event_to_dict(e) for e in events],
    }


@router.get("/sheet/{sheet_id}")
def get_stat_sheet(sheet_id: int, db: Session = Depends(get_db)):
    """Get a stat sheet with all its events."""
    sheet = db.query(ClipStatSheet).filter(ClipStatSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Stat sheet not found")

    events = (
        db.query(DetectedEvent)
        .filter(DetectedEvent.stat_sheet_id == sheet_id)
        .order_by(DetectedEvent.timestamp_seconds)
        .all()
    )

    return {
        "stat_sheet": _sheet_to_dict(sheet),
        "events": [_event_to_dict(e) for e in events],
    }


@router.put("/events/{event_id}")
def review_event(event_id: int, body: EventReviewBody, db: Session = Depends(get_db)):
    """Review a single detected event: confirm/reject and optionally relabel."""
    event = db.query(DetectedEvent).filter(DetectedEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.reviewed = True
    if body.confirmed is not None:
        event.confirmed = body.confirmed
    if body.user_label is not None:
        event.user_label = body.user_label
    if body.notes is not None:
        event.notes = body.notes

    db.commit()
    db.refresh(event)
    return _event_to_dict(event)


@router.post("/events/{sheet_id}")
def add_manual_event(sheet_id: int, body: ManualEventBody, db: Session = Depends(get_db)):
    """Manually add an event to a stat sheet."""
    sheet = db.query(ClipStatSheet).filter(ClipStatSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Stat sheet not found")

    event = DetectedEvent(
        clip_id=sheet.clip_id,
        stat_sheet_id=sheet.id,
        timestamp_seconds=body.timestamp_seconds,
        event_type="manual",
        auto_detected=False,
        reviewed=True,
        confirmed=True,
        user_label=body.user_label,
        notes=body.notes,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_to_dict(event)


@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Remove an event."""
    event = db.query(DetectedEvent).filter(DetectedEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
    return {"detail": "Event deleted", "id": event_id}


@router.post("/compile/{sheet_id}")
def compile_stat_sheet(sheet_id: int, db: Session = Depends(get_db)):
    """Compile confirmed events into final stat tallies on the stat sheet."""
    sheet = db.query(ClipStatSheet).filter(ClipStatSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Stat sheet not found")

    # Only count confirmed events that have a user_label
    events = (
        db.query(DetectedEvent)
        .filter(
            DetectedEvent.stat_sheet_id == sheet_id,
            DetectedEvent.confirmed == True,
            DetectedEvent.user_label.isnot(None),
        )
        .all()
    )

    # Tally labels
    counts: dict[str, int] = {}
    for e in events:
        label = e.user_label
        counts[label] = counts.get(label, 0) + 1

    fg_made = counts.get("fg_made", 0)
    fg_missed = counts.get("fg_missed", 0)
    three_made = counts.get("three_made", 0)
    three_missed = counts.get("three_missed", 0)
    ft_made = counts.get("ft_made", 0)
    ft_missed = counts.get("ft_missed", 0)

    sheet.fg_made = fg_made + three_made  # total FG made includes threes
    sheet.fg_attempted = fg_made + fg_missed + three_made + three_missed
    sheet.three_made = three_made
    sheet.three_attempted = three_made + three_missed
    sheet.ft_made = ft_made
    sheet.ft_attempted = ft_made + ft_missed
    sheet.rebounds = counts.get("rebound", 0)
    sheet.assists = counts.get("assist", 0)
    sheet.steals = counts.get("steal", 0)
    sheet.blocks = counts.get("block", 0)
    sheet.turnovers = counts.get("turnover", 0)

    # Points: 2-pt field goals + 3-pt field goals + free throws
    two_pt_made = fg_made  # fg_made label means non-three 2-pointer
    sheet.points = two_pt_made * 2 + three_made * 3 + ft_made

    sheet.status = "finalized"

    db.commit()
    db.refresh(sheet)

    return _sheet_to_dict(sheet)


@router.get("/sheets")
def list_stat_sheets(sport: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """List all stat sheets, optionally filtered by sport."""
    query = db.query(ClipStatSheet).order_by(ClipStatSheet.created_at.desc())
    if sport:
        query = query.filter(ClipStatSheet.sport == sport)
    sheets = query.all()
    return [_sheet_to_dict(s) for s in sheets]


@router.get("/sheets/{clip_id}/latest")
def get_latest_stat_sheet(clip_id: int, db: Session = Depends(get_db)):
    """Get the most recent stat sheet for a clip."""
    sheet = (
        db.query(ClipStatSheet)
        .filter(ClipStatSheet.clip_id == clip_id)
        .order_by(ClipStatSheet.created_at.desc())
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=404, detail="No stat sheet found for this clip")

    events = (
        db.query(DetectedEvent)
        .filter(DetectedEvent.stat_sheet_id == sheet.id)
        .order_by(DetectedEvent.timestamp_seconds)
        .all()
    )

    return {
        "stat_sheet": _sheet_to_dict(sheet),
        "events": [_event_to_dict(e) for e in events],
    }
