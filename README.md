# Sports Analytics Dashboard

Personal "film + stats" dashboard for tracking basketball and volleyball sessions, plotting performance trends, auto-generating weekly training focus, and analyzing basketball clips.

## Features

- **Session Logging** — Log basketball or volleyball sessions with sport-specific stats (shooting splits, rebounds, kills, digs, etc.)
- **Trend Charts** — Visualize performance trends over time with interactive Recharts graphs
- **Training Focus Generator** — Auto-generates weekly training priorities based on your last 4 weeks of data, identifying weak areas and declining trends
- **Video Clips & Play Tags** — Upload game/practice clips, tag plays at specific timestamps (shots, passes, blocks, etc.)
- **Basketball Clip Analysis** — OpenCV + MediaPipe-powered analysis that detects shot attempts, evaluates form (elbow alignment, follow-through), tracks movement patterns, and maps court position zones

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Frontend | React, Recharts, React Router, Axios |
| Video Analysis | OpenCV, MediaPipe Pose |

## Quick Start

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API runs at http://localhost:8000

### Frontend
```bash
cd frontend
npm install
npm start
```
App runs at http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/` | Log a session with stats |
| GET | `/api/sessions/` | List sessions (filter by sport) |
| GET | `/api/sessions/trends/{sport}` | Get stat trends for charting |
| POST | `/api/clips/upload` | Upload a video clip |
| POST | `/api/clips/{id}/tags` | Tag a play at a timestamp |
| POST | `/api/analysis/basketball/{clip_id}` | Run clip analysis |
| POST | `/api/training/generate/{sport}` | Generate weekly training focus |
| GET | `/api/training/current/{sport}` | Get this week's focus |

## Screenshots

*Dark-themed dashboard with trend charts, session logger, video player with play tags, and training focus radar chart.*
