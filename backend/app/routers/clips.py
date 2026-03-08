import os
import uuid
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clip, PlayTag

router = APIRouter(prefix="/api/clips", tags=["clips"])

UPLOADS_DIR = Path("uploads")
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi"}


class TagCreate(BaseModel):
    timestamp_seconds: float
    tag_type: str
    description: Optional[str] = None


@router.post("/upload")
async def upload_clip(
    file: UploadFile = File(...),
    session_id: Optional[int] = None,
    sport: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOADS_DIR / unique_filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    clip = Clip(
        session_id=session_id,
        filename=unique_filename,
        original_filename=file.filename,
        sport=sport,
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)

    return _clip_to_dict(clip)


@router.get("/")
def list_clips(
    sport: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Clip)
    if sport:
        query = query.filter(Clip.sport == sport)
    total = query.count()
    clips = query.order_by(desc(Clip.uploaded_at)).offset(skip).limit(limit).all()
    return {
        "total": total,
        "clips": [_clip_to_dict(c) for c in clips],
    }


@router.get("/{clip_id}")
def get_clip(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    result = _clip_to_dict(clip)
    result["tags"] = [
        {
            "id": t.id,
            "timestamp_seconds": t.timestamp_seconds,
            "tag_type": t.tag_type,
            "description": t.description,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in clip.tags
    ]
    return result


@router.post("/{clip_id}/tags")
def add_tag(clip_id: int, data: TagCreate, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    tag = PlayTag(
        clip_id=clip_id,
        timestamp_seconds=data.timestamp_seconds,
        tag_type=data.tag_type,
        description=data.description,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    return {
        "id": tag.id,
        "clip_id": tag.clip_id,
        "timestamp_seconds": tag.timestamp_seconds,
        "tag_type": tag.tag_type,
        "description": tag.description,
        "created_at": tag.created_at.isoformat() if tag.created_at else None,
    }


@router.delete("/{clip_id}/tags/{tag_id}")
def delete_tag(clip_id: int, tag_id: int, db: Session = Depends(get_db)):
    tag = (
        db.query(PlayTag)
        .filter(PlayTag.id == tag_id, PlayTag.clip_id == clip_id)
        .first()
    )
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"detail": "Tag deleted"}


@router.delete("/{clip_id}")
def delete_clip(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    # Remove file from disk
    file_path = UPLOADS_DIR / clip.filename
    if file_path.exists():
        file_path.unlink()

    db.delete(clip)
    db.commit()
    return {"detail": "Clip deleted"}


def _clip_to_dict(clip: Clip) -> dict:
    return {
        "id": clip.id,
        "session_id": clip.session_id,
        "filename": clip.filename,
        "original_filename": clip.original_filename,
        "sport": clip.sport,
        "uploaded_at": clip.uploaded_at.isoformat() if clip.uploaded_at else None,
        "url": f"/uploads/{clip.filename}",
    }
