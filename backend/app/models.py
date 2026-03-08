from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
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


class TrainingFocus(Base):
    __tablename__ = "training_focuses"

    id = Column(Integer, primary_key=True, index=True)
    sport = Column(String, nullable=False)
    week_start = Column(String, nullable=False)  # ISO date string (Monday of the week)
    focus_areas = Column(Text, nullable=False)  # JSON string
    reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
