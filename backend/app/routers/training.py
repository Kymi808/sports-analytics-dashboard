import json
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Session as SessionModel, SessionStat, TrainingFocus

router = APIRouter(prefix="/api/training", tags=["training"])


def _get_week_start(date_str: str) -> str:
    """Get the Monday of the week for a given ISO date string."""
    dt = datetime.fromisoformat(date_str)
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


def _current_week_start() -> str:
    today = datetime.utcnow()
    monday = today - timedelta(days=today.weekday())
    return monday.strftime("%Y-%m-%d")


def _generate_basketball_focus(weekly_stats: dict[str, dict[str, list[float]]]) -> dict:
    """Analyze basketball stats and generate training focus areas.

    weekly_stats: {week_start: {stat_name: [values]}}
    """
    focus_areas = []
    reasoning_parts = []

    # Aggregate averages per week
    weekly_averages: dict[str, dict[str, float]] = {}
    for week, stats in weekly_stats.items():
        weekly_averages[week] = {}
        for stat_name, values in stats.items():
            weekly_averages[week][stat_name] = sum(values) / len(values) if values else 0.0

    sorted_weeks = sorted(weekly_averages.keys())
    if not sorted_weeks:
        return {"focus_areas": ["General conditioning"], "reasoning": "No data available."}

    latest = weekly_averages[sorted_weeks[-1]]

    # Shooting percentage analysis
    fg_made = latest.get("fg_made", 0)
    fg_attempted = latest.get("fg_attempted", 0)
    fg_pct = (fg_made / fg_attempted * 100) if fg_attempted > 0 else 0

    three_made = latest.get("three_made", 0)
    three_attempted = latest.get("three_attempted", 0)
    three_pct = (three_made / three_attempted * 100) if three_attempted > 0 else 0

    ft_made = latest.get("ft_made", 0)
    ft_attempted = latest.get("ft_attempted", 0)
    ft_pct = (ft_made / ft_attempted * 100) if ft_attempted > 0 else 0

    if fg_pct < 40:
        focus_areas.append("Field goal shooting - mid-range and layup drills")
        reasoning_parts.append(f"FG% is low at {fg_pct:.1f}%")

    if three_pct < 30:
        focus_areas.append("Three-point shooting form and consistency")
        reasoning_parts.append(f"3PT% is low at {three_pct:.1f}%")

    if ft_pct < 70:
        focus_areas.append("Free throw routine and practice")
        reasoning_parts.append(f"FT% is low at {ft_pct:.1f}%")

    # Turnover analysis
    turnovers = latest.get("turnovers", 0)
    assists = latest.get("assists", 0)
    if turnovers > 0 and (assists == 0 or turnovers / max(assists, 1) > 0.5):
        focus_areas.append("Ball handling and turnover reduction")
        reasoning_parts.append(f"Turnover rate is high ({turnovers:.0f} TO vs {assists:.0f} AST)")

    # Rebounding
    rebounds = latest.get("rebounds", 0)
    if rebounds < 5:
        focus_areas.append("Rebounding positioning and boxing out")
        reasoning_parts.append(f"Averaging only {rebounds:.1f} rebounds")

    # Trend analysis: detect declining stats
    if len(sorted_weeks) >= 2:
        prev = weekly_averages[sorted_weeks[-2]]
        for stat in ["points", "rebounds", "assists", "steals"]:
            prev_val = prev.get(stat, 0)
            curr_val = latest.get(stat, 0)
            if prev_val > 0 and curr_val < prev_val * 0.75:
                focus_areas.append(f"Improve declining {stat} (down {((prev_val - curr_val) / prev_val * 100):.0f}%)")
                reasoning_parts.append(f"{stat} dropped from {prev_val:.1f} to {curr_val:.1f}")

    if not focus_areas:
        focus_areas.append("Maintain current performance levels")
        focus_areas.append("Work on defensive intensity")
        reasoning_parts.append("Stats are generally solid; focus on maintaining and defense")

    # Limit to 5 focus areas
    focus_areas = focus_areas[:5]

    return {
        "focus_areas": focus_areas,
        "reasoning": "; ".join(reasoning_parts) if reasoning_parts else "Balanced performance across categories.",
    }


def _generate_volleyball_focus(weekly_stats: dict[str, dict[str, list[float]]]) -> dict:
    """Analyze volleyball stats and generate training focus areas."""
    focus_areas = []
    reasoning_parts = []

    weekly_averages: dict[str, dict[str, float]] = {}
    for week, stats in weekly_stats.items():
        weekly_averages[week] = {}
        for stat_name, values in stats.items():
            weekly_averages[week][stat_name] = sum(values) / len(values) if values else 0.0

    sorted_weeks = sorted(weekly_averages.keys())
    if not sorted_weeks:
        return {"focus_areas": ["General conditioning"], "reasoning": "No data available."}

    latest = weekly_averages[sorted_weeks[-1]]

    # Hitting percentage
    hitting_pct = latest.get("hitting_percentage", 0)
    if hitting_pct < 0.200:
        focus_areas.append("Attacking efficiency - shot selection and arm swing")
        reasoning_parts.append(f"Hitting percentage is low at {hitting_pct:.3f}")

    # Serve consistency
    aces = latest.get("aces", 0)
    service_errors = latest.get("service_errors", 0)
    if service_errors > aces:
        focus_areas.append("Serve consistency and placement")
        reasoning_parts.append(f"Service errors ({service_errors:.0f}) exceed aces ({aces:.0f})")

    # Dig rate
    digs = latest.get("digs", 0)
    if digs < 5:
        focus_areas.append("Defensive positioning and digging technique")
        reasoning_parts.append(f"Low dig average ({digs:.1f})")

    # Blocking
    blocks = latest.get("blocks", 0)
    if blocks < 1:
        focus_areas.append("Block timing and footwork")
        reasoning_parts.append(f"Low block average ({blocks:.1f})")

    # Trend analysis
    if len(sorted_weeks) >= 2:
        prev = weekly_averages[sorted_weeks[-2]]
        for stat in ["kills", "assists", "digs", "aces"]:
            prev_val = prev.get(stat, 0)
            curr_val = latest.get(stat, 0)
            if prev_val > 0 and curr_val < prev_val * 0.75:
                focus_areas.append(f"Improve declining {stat} (down {((prev_val - curr_val) / prev_val * 100):.0f}%)")
                reasoning_parts.append(f"{stat} dropped from {prev_val:.1f} to {curr_val:.1f}")

    if not focus_areas:
        focus_areas.append("Maintain current performance levels")
        focus_areas.append("Work on transition offense speed")
        reasoning_parts.append("Stats are generally solid; focus on maintaining and transitions")

    focus_areas = focus_areas[:5]

    return {
        "focus_areas": focus_areas,
        "reasoning": "; ".join(reasoning_parts) if reasoning_parts else "Balanced performance across categories.",
    }


@router.post("/generate/{sport}")
def generate_training_focus(sport: str, db: Session = Depends(get_db)):
    if sport not in ("basketball", "volleyball"):
        raise HTTPException(status_code=400, detail="Sport must be 'basketball' or 'volleyball'")

    # Get sessions from last 4 weeks
    four_weeks_ago = (datetime.utcnow() - timedelta(weeks=4)).strftime("%Y-%m-%d")
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.sport == sport, SessionModel.date >= four_weeks_ago)
        .order_by(SessionModel.date)
        .all()
    )

    # Group stats by week
    weekly_stats: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for session in sessions:
        week_start = _get_week_start(session.date)
        for stat in session.stats:
            weekly_stats[week_start][stat.stat_name].append(stat.stat_value)

    if sport == "basketball":
        result = _generate_basketball_focus(dict(weekly_stats))
    else:
        result = _generate_volleyball_focus(dict(weekly_stats))

    week_start = _current_week_start()

    # Upsert: replace existing focus for this week/sport
    existing = (
        db.query(TrainingFocus)
        .filter(TrainingFocus.sport == sport, TrainingFocus.week_start == week_start)
        .first()
    )
    if existing:
        existing.focus_areas = json.dumps(result["focus_areas"])
        existing.reasoning = result["reasoning"]
        db.commit()
        db.refresh(existing)
        focus = existing
    else:
        focus = TrainingFocus(
            sport=sport,
            week_start=week_start,
            focus_areas=json.dumps(result["focus_areas"]),
            reasoning=result["reasoning"],
        )
        db.add(focus)
        db.commit()
        db.refresh(focus)

    return {
        "id": focus.id,
        "sport": focus.sport,
        "week_start": focus.week_start,
        "focus_areas": json.loads(focus.focus_areas),
        "reasoning": focus.reasoning,
        "created_at": focus.created_at.isoformat() if focus.created_at else None,
    }


@router.get("/current/{sport}")
def get_current_focus(sport: str, db: Session = Depends(get_db)):
    if sport not in ("basketball", "volleyball"):
        raise HTTPException(status_code=400, detail="Sport must be 'basketball' or 'volleyball'")

    week_start = _current_week_start()
    focus = (
        db.query(TrainingFocus)
        .filter(TrainingFocus.sport == sport, TrainingFocus.week_start == week_start)
        .first()
    )
    if not focus:
        raise HTTPException(status_code=404, detail="No training focus for current week. Generate one first.")

    return {
        "id": focus.id,
        "sport": focus.sport,
        "week_start": focus.week_start,
        "focus_areas": json.loads(focus.focus_areas),
        "reasoning": focus.reasoning,
        "created_at": focus.created_at.isoformat() if focus.created_at else None,
    }


@router.get("/history/{sport}")
def get_focus_history(sport: str, db: Session = Depends(get_db)):
    if sport not in ("basketball", "volleyball"):
        raise HTTPException(status_code=400, detail="Sport must be 'basketball' or 'volleyball'")

    focuses = (
        db.query(TrainingFocus)
        .filter(TrainingFocus.sport == sport)
        .order_by(desc(TrainingFocus.week_start))
        .all()
    )

    return [
        {
            "id": f.id,
            "sport": f.sport,
            "week_start": f.week_start,
            "focus_areas": json.loads(f.focus_areas),
            "reasoning": f.reasoning,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in focuses
    ]
