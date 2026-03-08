import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Clip, ClipAnalysis
from ..analyzer import analyze_basketball_clip

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

UPLOADS_DIR = Path("uploads")


@router.post("/basketball/{clip_id}")
def run_basketball_analysis(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    video_path = UPLOADS_DIR / clip.filename
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    results = analyze_basketball_clip(str(video_path))

    analysis = ClipAnalysis(
        clip_id=clip_id,
        analysis_type="basketball_pose",
        results=json.dumps(results),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "id": analysis.id,
        "clip_id": analysis.clip_id,
        "analysis_type": analysis.analysis_type,
        "results": results,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


@router.get("/{clip_id}")
def get_analysis(clip_id: int, db: Session = Depends(get_db)):
    analyses = (
        db.query(ClipAnalysis)
        .filter(ClipAnalysis.clip_id == clip_id)
        .order_by(ClipAnalysis.created_at.desc())
        .all()
    )
    if not analyses:
        raise HTTPException(status_code=404, detail="No analysis found for this clip")

    return [
        {
            "id": a.id,
            "clip_id": a.clip_id,
            "analysis_type": a.analysis_type,
            "results": json.loads(a.results),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in analyses
    ]
