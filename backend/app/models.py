from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    sport = Column(String, nullable=False)  # "basketball" or "volleyball"
    date = Column(String, nullable=False)  # ISO date string
    duration_minutes = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    stats = relationship("SessionStat", back_populates="session", cascade="all, delete-orphan")
    clips = relationship("Clip", back_populates="session")


class SessionStat(Base):
    __tablename__ = "session_stats"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    stat_name = Column(String, nullable=False)
    stat_value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="stats")


# Reference stat names per sport:
BASKETBALL_STATS = [
    "points", "rebounds", "assists", "steals", "blocks", "turnovers",
    "fg_made", "fg_attempted", "three_made", "three_attempted",
    "ft_made", "ft_attempted",
]

VOLLEYBALL_STATS = [
    "kills", "assists", "blocks", "digs", "aces",
    "service_errors", "hitting_percentage",
]


class Clip(Base):
    __tablename__ = "clips"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    sport = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="clips")
    tags = relationship("PlayTag", back_populates="clip", cascade="all, delete-orphan")
    analyses = relationship("ClipAnalysis", back_populates="clip", cascade="all, delete-orphan")
    stat_sheets = relationship("ClipStatSheet", back_populates="clip", cascade="all, delete-orphan")
    detected_events = relationship("DetectedEvent", back_populates="clip", cascade="all, delete-orphan")


class PlayTag(Base):
    __tablename__ = "play_tags"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(Integer, ForeignKey("clips.id", ondelete="CASCADE"), nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    tag_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    clip = relationship("Clip", back_populates="tags")


class ClipAnalysis(Base):
    __tablename__ = "clip_analyses"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(Integer, ForeignKey("clips.id", ondelete="CASCADE"), nullable=False)
    analysis_type = Column(String, nullable=False)
    results = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    clip = relationship("Clip", back_populates="analyses")


class ClipStatSheet(Base):
    __tablename__ = "clip_stat_sheets"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(Integer, ForeignKey("clips.id", ondelete="CASCADE"), nullable=False)
    sport = Column(String, nullable=False)
    status = Column(String, nullable=False, default="in_review")  # "in_review" | "finalized"

    # Basketball stats (populated on compile)
    points = Column(Integer, nullable=True)
    fg_made = Column(Integer, nullable=True)
    fg_attempted = Column(Integer, nullable=True)
    three_made = Column(Integer, nullable=True)
    three_attempted = Column(Integer, nullable=True)
    ft_made = Column(Integer, nullable=True)
    ft_attempted = Column(Integer, nullable=True)
    rebounds = Column(Integer, nullable=True)
    assists = Column(Integer, nullable=True)
    steals = Column(Integer, nullable=True)
    blocks = Column(Integer, nullable=True)
    turnovers = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    clip = relationship("Clip", back_populates="stat_sheets")
    events = relationship("DetectedEvent", back_populates="stat_sheet", cascade="all, delete-orphan")


class DetectedEvent(Base):
    __tablename__ = "detected_events"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(Integer, ForeignKey("clips.id", ondelete="CASCADE"), nullable=False)
    stat_sheet_id = Column(Integer, ForeignKey("clip_stat_sheets.id", ondelete="SET NULL"), nullable=True)
    timestamp_seconds = Column(Float, nullable=False)
    event_type = Column(String, nullable=False)  # "shot_attempt", "movement", "position_change", etc.
    auto_detected = Column(Boolean, nullable=False, default=True)
    reviewed = Column(Boolean, nullable=False, default=False)
    confirmed = Column(Boolean, nullable=False, default=False)
    user_label = Column(String, nullable=True)  # "fg_made", "fg_missed", "three_made", etc.
    notes = Column(Text, nullable=True)
    frame_number = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    clip = relationship("Clip", back_populates="detected_events")
    stat_sheet = relationship("ClipStatSheet", back_populates="events")


class TrainingFocus(Base):
    __tablename__ = "training_focuses"

    id = Column(Integer, primary_key=True, index=True)
    sport = Column(String, nullable=False)
    week_start = Column(String, nullable=False)  # ISO date string (Monday of the week)
    focus_areas = Column(Text, nullable=False)  # JSON string
    reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
