from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Session as SessionModel, SessionStat

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class StatInput(BaseModel):
    stat_name: str
    stat_value: float


class SessionCreate(BaseModel):
    sport: str
    date: str
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    stats: Optional[dict[str, float]] = None


class SessionResponse(BaseModel):
    id: int
    sport: str
    date: str
    duration_minutes: Optional[int]
    notes: Optional[str]
    created_at: datetime
    stats: list[dict]

    class Config:
        from_attributes = True


@router.post("/")
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    if data.sport not in ("basketball", "volleyball"):
        raise HTTPException(status_code=400, detail="Sport must be 'basketball' or 'volleyball'")

    session = SessionModel(
        sport=data.sport,
        date=data.date,
        duration_minutes=data.duration_minutes,
        notes=data.notes,
    )
    db.add(session)
    db.flush()

    if data.stats:
        for stat_name, stat_value in data.stats.items():
            stat = SessionStat(
                session_id=session.id,
                stat_name=stat_name,
                stat_value=float(stat_value),
            )
            db.add(stat)

    db.commit()
    db.refresh(session)

    return _session_to_dict(session)


@router.get("/")
def list_sessions(
    sport: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(SessionModel)
    if sport:
        query = query.filter(SessionModel.sport == sport)
    total = query.count()
    sessions = query.order_by(desc(SessionModel.date)).offset(skip).limit(limit).all()
    return {
        "total": total,
        "sessions": [_session_to_dict(s) for s in sessions],
    }


@router.get("/trends/{sport}")
def get_trends(sport: str, db: Session = Depends(get_db)):
    if sport not in ("basketball", "volleyball"):
        raise HTTPException(status_code=400, detail="Sport must be 'basketball' or 'volleyball'")

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.sport == sport)
        .order_by(SessionModel.date)
        .all()
    )

    trends: dict[str, list[dict]] = {}
    for session in sessions:
        for stat in session.stats:
            if stat.stat_name not in trends:
                trends[stat.stat_name] = []
            trends[stat.stat_name].append({
                "date": session.date,
                "value": stat.stat_value,
                "session_id": session.id,
            })

    return {"sport": sport, "trends": trends}


@router.get("/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session)


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"detail": "Session deleted"}


def _session_to_dict(session: SessionModel) -> dict:
    return {
        "id": session.id,
        "sport": session.sport,
        "date": session.date,
        "duration_minutes": session.duration_minutes,
        "notes": session.notes,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "stats": [
            {
                "id": s.id,
                "stat_name": s.stat_name,
                "stat_value": s.stat_value,
            }
            for s in session.stats
        ],
    }
